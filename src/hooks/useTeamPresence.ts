// ── useTeamPresence ──
// Presença em tempo real da equipe (paridade com o CRM web):
// - heartbeat a cada 15s no RTDB (team_presence/{merchantId}/{uid}) com onDisconnect
// - dual-sync no Firestore (merchants/{merchantId}/teamPresence/{uid}) como fallback
// - escuta o mapa de presença de RTDB (primário) e Firestore (fallback < 45s)

import { useCallback, useEffect, useState } from "react";
import {
  ref,
  onValue,
  set as rtdbSetRaw,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
} from "firebase/database";
import {
  doc,
  setDoc as fsSetDocRaw,
  onSnapshot,
  collection,
  serverTimestamp as fsServerTimestamp,
} from "firebase/firestore";
import { db, rtdb } from "@/lib/firebase";
import type { TeamPresence } from "@/lib/teamRoles";

export function useTeamPresence(
  merchantId: string,
  currentUser?: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  }
) {
  const [rtdbPresenceMap, setRtdbPresenceMap] = useState<Record<string, TeamPresence>>({});
  const [firestorePresenceMap, setFirestorePresenceMap] = useState<Record<string, TeamPresence>>({});

  const currentUid = currentUser?.uid;
  const currentEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : "";
  const currentName = currentUser?.displayName || "";
  const currentPhoto = currentUser?.photoURL || "";

  // 1. Registra presença do usuário (RTDB + onDisconnect + dual-sync Firestore)
  useEffect(() => {
    if (!merchantId || !currentUid || !rtdb) return;

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    const userPresenceRef = ref(rtdb, `team_presence/${merchantId}/${currentUid}`);

    const onlinePayload = {
      isOnline: true,
      lastSeen: rtdbServerTimestamp(),
      email: currentEmail,
      name: currentName,
      avatarUrl: currentPhoto || null,
    };

    // Registra onDisconnect + marca online agora
    try {
      onDisconnect(userPresenceRef)
        .set({ ...onlinePayload, isOnline: false })
        .catch(() => {});
      rtdbSetRaw(userPresenceRef, onlinePayload).catch(() => {});
    } catch { /* offline ainda — o heartbeat cuida */ }

    // Heartbeat 15s
    heartbeatTimer = setInterval(() => {
      if (navigator.onLine) {
        try {
          rtdbSetRaw(userPresenceRef, { ...onlinePayload, lastSeen: rtdbServerTimestamp() }).catch(() => {});
        } catch { /* ignore */ }
        try {
          fsSetDocRaw(
            doc(db, "merchants", merchantId, "teamPresence", currentUid),
            {
              isOnline: true,
              lastSeen: fsServerTimestamp(),
              email: currentEmail,
              name: currentName,
              avatarUrl: currentPhoto || null,
            },
            { merge: true }
          ).catch(() => {});
        } catch { /* ignore */ }
      }
    }, 15000);

    // Re-marca quando a janela volta a ter foco
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        try {
          rtdbSetRaw(userPresenceRef, onlinePayload).catch(() => {});
        } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [merchantId, currentUid, currentEmail, currentName, currentPhoto]);

  // 2. Escuta presença da equipe no RTDB (fonte primária)
  useEffect(() => {
    if (!rtdb || !merchantId) return;
    const teamPresenceRef = ref(rtdb, `team_presence/${merchantId}`);
    const unsub = onValue(
      teamPresenceRef,
      (snap) => {
        if (snap.exists()) {
          setRtdbPresenceMap((snap.val() as Record<string, TeamPresence>) || {});
        } else {
          setRtdbPresenceMap({});
        }
      },
      () => {}
    );
    return () => {
      try { unsub(); } catch { /* ignore */ }
    };
  }, [merchantId]);

  // 3. Escuta fallback no Firestore
  useEffect(() => {
    if (!merchantId) return;
    const colRef = collection(db, "merchants", merchantId, "teamPresence");
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const map: Record<string, TeamPresence> = {};
        snapshot.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            isOnline: data.isOnline ?? false,
            lastSeen: data.lastSeen,
            email: data.email,
            name: data.name,
            avatarUrl: data.avatarUrl,
          };
        });
        setFirestorePresenceMap(map);
      },
      () => {}
    );
    return () => {
      try { unsub(); } catch { /* ignore */ }
    };
  }, [merchantId]);

  const getTimestampMs = (lastSeen: unknown): number | null => {
    const ls = lastSeen as any;
    if (!ls) return null;
    if (typeof ls === "number") return ls;
    if (typeof ls?.toMillis === "function") return ls.toMillis();
    if (typeof ls?.seconds === "number") return ls.seconds * 1000;
    return null;
  };

  const getMemberPresence = useCallback(
    (userId?: string, email?: string, memberId?: string): TeamPresence => {
      const cleanEmail = email ? email.toLowerCase().trim() : "";

      // 1. Usuário local autenticado → sempre "online" se tem rede
      const isCurrentUser = Boolean(
        currentUid &&
          ((userId && userId === currentUid) ||
            (memberId && (memberId === currentUid || memberId === `owner_${currentUid}`)) ||
            (cleanEmail && currentEmail && cleanEmail === currentEmail))
      );
      if (isCurrentUser) {
        return {
          isOnline: navigator.onLine,
          lastSeen: null,
          email: currentEmail || cleanEmail,
          name: currentName,
          avatarUrl: currentPhoto || undefined,
        };
      }

      // 2. RTDB (primário, com onDisconnect nativo)
      let rtdbEntry: TeamPresence | undefined;
      if (userId && rtdbPresenceMap[userId]) {
        rtdbEntry = rtdbPresenceMap[userId];
      } else if (memberId && rtdbPresenceMap[memberId]) {
        rtdbEntry = rtdbPresenceMap[memberId];
      } else if (cleanEmail) {
        rtdbEntry = Object.values(rtdbPresenceMap).find(
          (p) => p.email && p.email.toLowerCase().trim() === cleanEmail
        );
      }
      if (rtdbEntry) {
        return { ...rtdbEntry, isOnline: rtdbEntry.isOnline === true };
      }

      // 3. Fallback Firestore (online só se heartbeat < 45s)
      let fsEntry: TeamPresence | undefined;
      if (userId && firestorePresenceMap[userId]) {
        fsEntry = firestorePresenceMap[userId];
      } else if (memberId && firestorePresenceMap[memberId]) {
        fsEntry = firestorePresenceMap[memberId];
      } else if (cleanEmail) {
        fsEntry = Object.values(firestorePresenceMap).find(
          (p) => p.email && p.email.toLowerCase().trim() === cleanEmail
        );
      }
      if (fsEntry) {
        const tsMs = getTimestampMs(fsEntry.lastSeen);
        return { ...fsEntry, isOnline: tsMs !== null && Date.now() - tsMs < 45000 };
      }

      // 4. Sem registro
      return { isOnline: false, lastSeen: null, email: cleanEmail };
    },
    [currentUid, currentEmail, currentName, currentPhoto, rtdbPresenceMap, firestorePresenceMap]
  );

  return { presenceMap: rtdbPresenceMap, getMemberPresence };
}
