"use client";

import React, { useState, useMemo, useCallback } from "react";

// ============================================================================
// 1. STRUKTUR DATA & INTERFACES
// ============================================================================

/**
 * Data Pemain:
 * - id: identitas unik
 * - name: nama pemain
 * - level: level kemampuan (1-5)
 * - isPresent: status kehadiran (checkbox)
 * - arrivalOrder: urutan kedatangan
 * - isAdmin: status pemain spesial (Admin / Host / User)
 */
export interface Player {
  id: string;
  name: string;
  level: number; // 1 (Pemula) - 5 (Mahir)
  isPresent: boolean;
  arrivalOrder: number;
  isAdmin?: boolean; // Pemain spesial (Admin / Host)
}

/**
 * Pasangan Ganda (2 Pemain)
 */
export interface DoublesTeam {
  player1Id: string;
  player2Id: string;
}

/**
 * Pertandingan di 1 Lapangan (Court)
 */
export interface CourtMatch {
  courtNumber: 1 | 2;
  teamA: DoublesTeam;
  teamB: DoublesTeam;
  teamALevel: number;
  teamBLevel: number;
  levelDiff: number;
}

/**
 * Data Hasil Proyeksi Setiap Match (M1, M2, dst)
 */
export interface MatchProjection {
  matchIndex: number; // 1-indexed (M1, M2, dst)
  court1: CourtMatch | null;
  court2: CourtMatch | null;
  playingPlayerIds: Set<string>;
  waitingPlayerIds: string[];
  isOverridden: boolean;
  playerCourts: Record<string, "c1" | "c2" | null>;
  // Snapshot statistik pada match ini untuk keperluan audit/UI
  waitCountsSnapshot: Record<string, number>;
  matchesPlayedSnapshot: Record<string, number>;
}

/**
 * Data Override Manual oleh User
 */
export interface MatchOverride {
  court1: {
    teamA: [string, string];
    teamB: [string, string];
  } | null;
  court2: {
    teamA: [string, string];
    teamB: [string, string];
  } | null;
}

/**
 * Data Shuttlecock per Lapangan pada tiap Match
 */
export interface CourtShuttlecockData {
  court1: number;
  court2: number;
}

// ============================================================================
// 2. DATA AWAL CONTOH (TERMASUK PEMAIN SPESIAL ADMIN / HOST)
// ============================================================================

const INITIAL_PLAYERS: Player[] = [
  // Pemain Spesial (Admin / Host / User itu sendiri)
  {
    id: "admin",
    name: "User (Admin / Host)",
    level: 3,
    isPresent: true,
    arrivalOrder: 1,
    isAdmin: true,
  },
  // Daftar Pemain Reguler
  { id: "p1", name: "Hendra Setiawan", level: 5, isPresent: true, arrivalOrder: 2 },
  { id: "p2", name: "Mohammad Ahsan", level: 5, isPresent: true, arrivalOrder: 3 },
  { id: "p3", name: "Kevin Sanjaya", level: 5, isPresent: true, arrivalOrder: 4 },
  { id: "p4", name: "Marcus Gideon", level: 4, isPresent: true, arrivalOrder: 5 },
  { id: "p5", name: "Fajar Alfian", level: 4, isPresent: true, arrivalOrder: 6 },
  { id: "p6", name: "M. Rian Ardianto", level: 4, isPresent: true, arrivalOrder: 7 },
  { id: "p7", name: "Anthony Ginting", level: 4, isPresent: true, arrivalOrder: 8 },
  { id: "p8", name: "Jonatan Christie", level: 4, isPresent: true, arrivalOrder: 9 },
  { id: "p9", name: "Bagas Maulana", level: 3, isPresent: true, arrivalOrder: 10 },
  { id: "p10", name: "M. Shohibul Fikri", level: 3, isPresent: true, arrivalOrder: 11 },
  { id: "p11", name: "Leo Rolly Carnando", level: 3, isPresent: false, arrivalOrder: 0 },
  { id: "p12", name: "Daniel Marthin", level: 2, isPresent: false, arrivalOrder: 0 },
];

// ============================================================================
// 3. LOGIKA ALGORITMA ROTASI & SELEKSI PEMAIN
// ============================================================================

function calculateMatchCourtPenalty(
  teamA: [Player, Player],
  teamB: [Player, Player],
  currentMatchIndex: number,
  partnerHistory: Map<string, Map<string, number[]>>,
  opponentHistory: Map<string, Map<string, number[]>>
): number {
  let penalty = 0;

  const checkPartner = (p1: Player, p2: Player) => {
    const list = partnerHistory.get(p1.id)?.get(p2.id) || [];
    const count = list.length;
    if (count > 0) {
      const lastMatch = list[list.length - 1];
      if (lastMatch === currentMatchIndex - 1) {
        penalty += 1500;
      } else if (lastMatch === currentMatchIndex - 2) {
        penalty += 600;
      }
      penalty += count * 250;
    }
  };

  const checkOpponent = (p1: Player, p2: Player) => {
    const list = opponentHistory.get(p1.id)?.get(p2.id) || [];
    const count = list.length;
    if (count > 0) {
      const lastMatch = list[list.length - 1];
      if (lastMatch === currentMatchIndex - 1) {
        penalty += 300;
      } else if (lastMatch === currentMatchIndex - 2) {
        penalty += 100;
      }
      penalty += count * 60;
    }
  };

  checkPartner(teamA[0], teamA[1]);
  checkPartner(teamB[0], teamB[1]);

  checkOpponent(teamA[0], teamB[0]);
  checkOpponent(teamA[0], teamB[1]);
  checkOpponent(teamA[1], teamB[0]);
  checkOpponent(teamA[1], teamB[1]);

  const levelTeamA = teamA[0].level + teamA[1].level;
  const levelTeamB = teamB[0].level + teamB[1].level;
  const levelGap = Math.abs(levelTeamA - levelTeamB);

  // Upgrade Logika: Prioritaskan kesetaraan level (maksimal selisih 2 level sesuai updatelogic.txt)
  // - levelGap <= 2 diperbolehkan dan diprioritaskan
  // - levelGap > 2 diberikan penalti masif (10.000+) sehingga algoritma tidak akan memilih
  //   pertandingan timpang walaupun rotasinya baru
  if (levelGap === 0) {
    penalty += 0;
  } else if (levelGap === 1) {
    penalty += 120;
  } else if (levelGap === 2) {
    penalty += 350;
  } else {
    // levelGap > 2 (gap 3, 4, dst)
    penalty += 10000 + (levelGap - 2) * 5000;
  }

  return penalty;
}

function optimizeCourtPairing(
  fourPlayers: [Player, Player, Player, Player],
  currentMatchIndex: number,
  partnerHistory: Map<string, Map<string, number[]>>,
  opponentHistory: Map<string, Map<string, number[]>>
): { teamA: [Player, Player]; teamB: [Player, Player]; penalty: number } {
  const [p0, p1, p2, p3] = fourPlayers;

  const pairingOptions: Array<[[Player, Player], [Player, Player]]> = [
    [[p0, p1], [p2, p3]],
    [[p0, p2], [p1, p3]],
    [[p0, p3], [p1, p2]],
  ];

  let bestOption = pairingOptions[0];
  let minPenalty = Infinity;

  for (const [teamA, teamB] of pairingOptions) {
    const penalty = calculateMatchCourtPenalty(
      teamA,
      teamB,
      currentMatchIndex,
      partnerHistory,
      opponentHistory
    );
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestOption = [teamA, teamB];
    }
  }

  return { teamA: bestOption[0], teamB: bestOption[1], penalty: minPenalty };
}

function optimizeTwoCourtPairings(
  eightPlayers: Player[],
  currentMatchIndex: number,
  partnerHistory: Map<string, Map<string, number[]>>,
  opponentHistory: Map<string, Map<string, number[]>>
): {
  court1: { teamA: [Player, Player]; teamB: [Player, Player] };
  court2: { teamA: [Player, Player]; teamB: [Player, Player] };
} {
  const p0 = eightPlayers[0];
  const rest = eightPlayers.slice(1);

  let bestScore = Infinity;
  let bestResult = {
    court1: { teamA: [eightPlayers[0], eightPlayers[1]] as [Player, Player], teamB: [eightPlayers[2], eightPlayers[3]] as [Player, Player] },
    court2: { teamA: [eightPlayers[4], eightPlayers[5]] as [Player, Player], teamB: [eightPlayers[6], eightPlayers[7]] as [Player, Player] },
  };

  for (let i = 0; i < rest.length - 2; i++) {
    for (let j = i + 1; j < rest.length - 1; j++) {
      for (let k = j + 1; k < rest.length; k++) {
        const c1Candidates: [Player, Player, Player, Player] = [
          p0,
          rest[i],
          rest[j],
          rest[k],
        ];

        const c2Candidates = rest.filter(
          (p) => p.id !== rest[i].id && p.id !== rest[j].id && p.id !== rest[k].id
        ) as [Player, Player, Player, Player];

        const optC1 = optimizeCourtPairing(
          c1Candidates,
          currentMatchIndex,
          partnerHistory,
          opponentHistory
        );
        const optC2 = optimizeCourtPairing(
          c2Candidates,
          currentMatchIndex,
          partnerHistory,
          opponentHistory
        );

        const totalScore = optC1.penalty + optC2.penalty;

        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestResult = {
            court1: { teamA: optC1.teamA, teamB: optC1.teamB },
            court2: { teamA: optC2.teamA, teamB: optC2.teamB },
          };
        }
      }
    }
  }

  return bestResult;
}

/**
 * ENGINE SIMULASI UTAMA
 * 
 * Aturan Khusus Pemain Spesial (Admin):
 * 1. Admin TIDAK ikut seleksi otomatis (hanya bermain jika dimasukkan manual lewat override).
 * 2. Jika dimasukkan manual di match M, Admin bermain, riwayat partner & lawan Admin
 *    tercatat dan mempengaruhi kalkulasi anti-monoton & leveling untuk match M+1 dst.
 * 3. Pemain reguler yang tergantikan oleh Admin di match M akan bertambah waitCount-nya,
 *    sehingga mendapat prioritas main di match berikutnya.
 */
export function generateMatchProjections(
  allPlayers: Player[],
  projectionCount: number,
  overrides: Record<number, MatchOverride>
): MatchProjection[] {
  const activePlayers = allPlayers
    .filter((p) => p.isPresent)
    .sort((a, b) => a.arrivalOrder - b.arrivalOrder);

  const playerMap = new Map<string, Player>(allPlayers.map((p) => [p.id, p]));

  const currentWaitCount = new Map<string, number>();
  const currentMatchesPlayed = new Map<string, number>();
  const partnerHistory = new Map<string, Map<string, number[]>>();
  const opponentHistory = new Map<string, Map<string, number[]>>();

  for (const player of activePlayers) {
    currentWaitCount.set(player.id, 0);
    currentMatchesPlayed.set(player.id, 0);
    partnerHistory.set(player.id, new Map());
    opponentHistory.set(player.id, new Map());
  }

  const helperRecordPartnership = (p1Id: string, p2Id: string, matchIdx: number) => {
    if (!partnerHistory.has(p1Id)) partnerHistory.set(p1Id, new Map());
    if (!partnerHistory.has(p2Id)) partnerHistory.set(p2Id, new Map());

    const m1 = partnerHistory.get(p1Id)!;
    const m2 = partnerHistory.get(p2Id)!;

    m1.set(p2Id, [...(m1.get(p2Id) || []), matchIdx]);
    m2.set(p1Id, [...(m2.get(p1Id) || []), matchIdx]);
  };

  const helperRecordOpponents = (teamAIds: [string, string], teamBIds: [string, string], matchIdx: number) => {
    for (const aId of teamAIds) {
      for (const bId of teamBIds) {
        if (!opponentHistory.has(aId)) opponentHistory.set(aId, new Map());
        if (!opponentHistory.has(bId)) opponentHistory.set(bId, new Map());

        const m1 = opponentHistory.get(aId)!;
        const m2 = opponentHistory.get(bId)!;

        m1.set(bId, [...(m1.get(bId) || []), matchIdx]);
        m2.set(aId, [...(m2.get(aId) || []), matchIdx]);
      }
    }
  };

  const results: MatchProjection[] = [];

  for (let m = 1; m <= projectionCount; m++) {
    const isOverridden = Boolean(overrides[m]);
    let court1Match: CourtMatch | null = null;
    let court2Match: CourtMatch | null = null;
    const playingIds = new Set<string>();

    const playerCount = activePlayers.length;

    const waitCountsSnapshot: Record<string, number> = {};
    const matchesPlayedSnapshot: Record<string, number> = {};
    for (const p of activePlayers) {
      waitCountsSnapshot[p.id] = currentWaitCount.get(p.id) || 0;
      matchesPlayedSnapshot[p.id] = currentMatchesPlayed.get(p.id) || 0;
    }

    // KASUS A: MATCH INI DIOVERRIDE SECARA MANUAL OLEH USER (Admin bisa dipilih di sini)
    if (isOverridden) {
      const overrideData = overrides[m];
      if (overrideData.court1) {
        const [a1, a2] = overrideData.court1.teamA;
        const [b1, b2] = overrideData.court1.teamB;
        const pA1 = playerMap.get(a1);
        const pA2 = playerMap.get(a2);
        const pB1 = playerMap.get(b1);
        const pB2 = playerMap.get(b2);

        if (pA1 && pA2 && pB1 && pB2) {
          const teamALvl = pA1.level + pA2.level;
          const teamBLvl = pB1.level + pB2.level;
          court1Match = {
            courtNumber: 1,
            teamA: { player1Id: a1, player2Id: a2 },
            teamB: { player1Id: b1, player2Id: b2 },
            teamALevel: teamALvl,
            teamBLevel: teamBLvl,
            levelDiff: Math.abs(teamALvl - teamBLvl),
          };
          playingIds.add(a1);
          playingIds.add(a2);
          playingIds.add(b1);
          playingIds.add(b2);
        }
      }

      if (overrideData.court2) {
        const [a1, a2] = overrideData.court2.teamA;
        const [b1, b2] = overrideData.court2.teamB;
        const pA1 = playerMap.get(a1);
        const pA2 = playerMap.get(a2);
        const pB1 = playerMap.get(b1);
        const pB2 = playerMap.get(b2);

        if (pA1 && pA2 && pB1 && pB2) {
          const teamALvl = pA1.level + pA2.level;
          const teamBLvl = pB1.level + pB2.level;
          court2Match = {
            courtNumber: 2,
            teamA: { player1Id: a1, player2Id: a2 },
            teamB: { player1Id: b1, player2Id: b2 },
            teamALevel: teamALvl,
            teamBLevel: teamBLvl,
            levelDiff: Math.abs(teamALvl - teamBLvl),
          };
          playingIds.add(a1);
          playingIds.add(a2);
          playingIds.add(b1);
          playingIds.add(b2);
        }
      }
    } else {
      // KASUS B: GENERATE OTOMATIS
      // Pemain reguler yang eligible (Admin TIDAK ikut draft otomatis)
      const autoEligiblePlayers = activePlayers.filter((p) => !p.isAdmin);
      const eligibleCount = autoEligiblePlayers.length;

      if (eligibleCount < 4) {
        results.push({
          matchIndex: m,
          court1: null,
          court2: null,
          playingPlayerIds: new Set(),
          waitingPlayerIds: activePlayers.map((p) => p.id),
          isOverridden: false,
          playerCourts: {},
          waitCountsSnapshot,
          matchesPlayedSnapshot,
        });
        continue;
      }

      const slotsNeeded = eligibleCount >= 8 ? 8 : 4;

      const scoredPlayers = autoEligiblePlayers.map((p) => {
        const wait = currentWaitCount.get(p.id) || 0;
        const played = currentMatchesPlayed.get(p.id) || 0;

        let priorityScore = 0;
        if (wait >= 2) {
          priorityScore += 1_000_000 + (wait - 2) * 50_000;
        } else if (wait === 1) {
          priorityScore += 10_000;
        }

        priorityScore -= played * 150;
        priorityScore -= p.arrivalOrder * 0.05;

        return { player: p, score: priorityScore };
      });

      scoredPlayers.sort((a, b) => b.score - a.score);

      const selectedPlayers = scoredPlayers
        .slice(0, slotsNeeded)
        .map((sp) => sp.player);

      selectedPlayers.forEach((p) => playingIds.add(p.id));

      if (slotsNeeded === 4) {
        const opt = optimizeCourtPairing(
          selectedPlayers as [Player, Player, Player, Player],
          m,
          partnerHistory,
          opponentHistory
        );

        const teamALvl = opt.teamA[0].level + opt.teamA[1].level;
        const teamBLvl = opt.teamB[0].level + opt.teamB[1].level;

        court1Match = {
          courtNumber: 1,
          teamA: { player1Id: opt.teamA[0].id, player2Id: opt.teamA[1].id },
          teamB: { player1Id: opt.teamB[0].id, player2Id: opt.teamB[1].id },
          teamALevel: teamALvl,
          teamBLevel: teamBLvl,
          levelDiff: Math.abs(teamALvl - teamBLvl),
        };
      } else {
        const opt = optimizeTwoCourtPairings(
          selectedPlayers,
          m,
          partnerHistory,
          opponentHistory
        );

        const c1ALvl = opt.court1.teamA[0].level + opt.court1.teamA[1].level;
        const c1BLvl = opt.court1.teamB[0].level + opt.court1.teamB[1].level;

        const c2ALvl = opt.court2.teamA[0].level + opt.court2.teamA[1].level;
        const c2BLvl = opt.court2.teamB[0].level + opt.court2.teamB[1].level;

        court1Match = {
          courtNumber: 1,
          teamA: { player1Id: opt.court1.teamA[0].id, player2Id: opt.court1.teamA[1].id },
          teamB: { player1Id: opt.court1.teamB[0].id, player2Id: opt.court1.teamB[1].id },
          teamALevel: c1ALvl,
          teamBLevel: c1BLvl,
          levelDiff: Math.abs(c1ALvl - c1BLvl),
        };

        court2Match = {
          courtNumber: 2,
          teamA: { player1Id: opt.court2.teamA[0].id, player2Id: opt.court2.teamA[1].id },
          teamB: { player1Id: opt.court2.teamB[0].id, player2Id: opt.court2.teamB[1].id },
          teamALevel: c2ALvl,
          teamBLevel: c2BLvl,
          levelDiff: Math.abs(c2ALvl - c2BLvl),
        };
      }
    }

    const playerCourts: Record<string, "c1" | "c2" | null> = {};

    if (court1Match) {
      playerCourts[court1Match.teamA.player1Id] = "c1";
      playerCourts[court1Match.teamA.player2Id] = "c1";
      playerCourts[court1Match.teamB.player1Id] = "c1";
      playerCourts[court1Match.teamB.player2Id] = "c1";

      helperRecordPartnership(court1Match.teamA.player1Id, court1Match.teamA.player2Id, m);
      helperRecordPartnership(court1Match.teamB.player1Id, court1Match.teamB.player2Id, m);
      helperRecordOpponents(
        [court1Match.teamA.player1Id, court1Match.teamA.player2Id],
        [court1Match.teamB.player1Id, court1Match.teamB.player2Id],
        m
      );
    }

    if (court2Match) {
      playerCourts[court2Match.teamA.player1Id] = "c2";
      playerCourts[court2Match.teamA.player2Id] = "c2";
      playerCourts[court2Match.teamB.player1Id] = "c2";
      playerCourts[court2Match.teamB.player2Id] = "c2";

      helperRecordPartnership(court2Match.teamA.player1Id, court2Match.teamA.player2Id, m);
      helperRecordPartnership(court2Match.teamB.player1Id, court2Match.teamB.player2Id, m);
      helperRecordOpponents(
        [court2Match.teamA.player1Id, court2Match.teamA.player2Id],
        [court2Match.teamB.player1Id, court2Match.teamB.player2Id],
        m
      );
    }

    const waitingPlayerIds: string[] = [];

    for (const player of activePlayers) {
      if (playingIds.has(player.id)) {
        currentWaitCount.set(player.id, 0);
        currentMatchesPlayed.set(
          player.id,
          (currentMatchesPlayed.get(player.id) || 0) + 1
        );
      } else {
        playerCourts[player.id] = null;
        waitingPlayerIds.push(player.id);
        // Pemain biasa: tambah waitCount
        // Admin: tidak ikut auto-draft, jadi waitCount tetap 0
        if (!player.isAdmin) {
          currentWaitCount.set(
            player.id,
            (currentWaitCount.get(player.id) || 0) + 1
          );
        } else {
          currentWaitCount.set(player.id, 0);
        }
      }
    }

    results.push({
      matchIndex: m,
      court1: court1Match,
      court2: court2Match,
      playingPlayerIds: playingIds,
      waitingPlayerIds,
      isOverridden,
      playerCourts,
      waitCountsSnapshot,
      matchesPlayedSnapshot,
    });
  }

  return results;
}

// ============================================================================
// 4. SUBKOMPONEN UI: MODAL DETAIL, OVERRIDE, & MODAL EDIT BIAYA / DISKON
// ============================================================================

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchIndex: number;
  projection: MatchProjection | null;
  activePlayers: Player[];
  allPlayers: Player[];
  onSaveOverride: (matchIdx: number, override: MatchOverride) => void;
  onResetOverride: (matchIdx: number) => void;
  courtShuttlecocks: { court1: number; court2: number };
  onUpdateCourtShuttlecock: (
    matchIdx: number,
    court: "court1" | "court2",
    count: number
  ) => void;
}

const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  isOpen,
  onClose,
  matchIndex,
  projection,
  activePlayers,
  allPlayers,
  onSaveOverride,
  onResetOverride,
  courtShuttlecocks,
  onUpdateCourtShuttlecock,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playerMap = useMemo(() => {
    return new Map(allPlayers.map((p) => [p.id, p]));
  }, [allPlayers]);

  const [editC1A1, setEditC1A1] = useState("");
  const [editC1A2, setEditC1A2] = useState("");
  const [editC1B1, setEditC1B1] = useState("");
  const [editC1B2, setEditC1B2] = useState("");

  const [editC2A1, setEditC2A1] = useState("");
  const [editC2A2, setEditC2A2] = useState("");
  const [editC2B1, setEditC2B1] = useState("");
  const [editC2B2, setEditC2B2] = useState("");

  React.useEffect(() => {
    if (!projection) return;
    setIsEditMode(projection.isOverridden);
    setErrorMsg(null);

    if (projection.court1) {
      setEditC1A1(projection.court1.teamA.player1Id);
      setEditC1A2(projection.court1.teamA.player2Id);
      setEditC1B1(projection.court1.teamB.player1Id);
      setEditC1B2(projection.court1.teamB.player2Id);
    } else {
      setEditC1A1("");
      setEditC1A2("");
      setEditC1B1("");
      setEditC1B2("");
    }

    if (projection.court2) {
      setEditC2A1(projection.court2.teamA.player1Id);
      setEditC2A2(projection.court2.teamA.player2Id);
      setEditC2B1(projection.court2.teamB.player1Id);
      setEditC2B2(projection.court2.teamB.player2Id);
    } else {
      setEditC2A1("");
      setEditC2A2("");
      setEditC2B1("");
      setEditC2B2("");
    }
  }, [projection, isOpen]);

  const getPlayerStatusInMatch = useCallback(
    (player: Player) => {
      const isPlayingInThisMatch = [
        editC1A1,
        editC1A2,
        editC1B1,
        editC1B2,
        editC2A1,
        editC2A2,
        editC2B1,
        editC2B2,
      ].includes(player.id);

      if (isPlayingInThisMatch) {
        return "(sedang bermain)";
      }

      if (player.isAdmin) {
        return "(standby / manual only)";
      }

      const wait = projection?.waitCountsSnapshot?.[player.id] ?? 0;
      return `(tunggu ${wait}x)`;
    },
    [
      editC1A1,
      editC1A2,
      editC1B1,
      editC1B2,
      editC2A1,
      editC2A2,
      editC2B1,
      editC2B2,
      projection,
    ]
  );

  if (!isOpen || !projection) return null;

  const handleSave = () => {
    setErrorMsg(null);
    const hasC1 = Boolean(editC1A1 && editC1A2 && editC1B1 && editC1B2);
    const hasC2 = Boolean(editC2A1 && editC2A2 && editC2B1 && editC2B2);

    if (!hasC1 && !hasC2) {
      setErrorMsg("Harap pilih susunan pemain untuk minimal Court 1!");
      return;
    }

    const selectedIds: string[] = [];
    if (hasC1) selectedIds.push(editC1A1, editC1A2, editC1B1, editC1B2);
    if (hasC2) selectedIds.push(editC2A1, editC2A2, editC2B1, editC2B2);

    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== selectedIds.length) {
      setErrorMsg("Ada pemain yang dipilih lebih dari 1 kali dalam match yang sama!");
      return;
    }

    const overrideObj: MatchOverride = {
      court1: hasC1
        ? {
            teamA: [editC1A1, editC1A2],
            teamB: [editC1B1, editC1B2],
          }
        : null,
      court2: hasC2
        ? {
            teamA: [editC2A1, editC2A2],
            teamB: [editC2B1, editC2B2],
          }
        : null,
    };

    onSaveOverride(matchIndex, overrideObj);
    onClose();
  };

  const handleReset = () => {
    onResetOverride(matchIndex);
    onClose();
  };

  const c1Cock = courtShuttlecocks.court1 || 0;
  const c2Cock = courtShuttlecocks.court2 || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-emerald-950/20 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-lg">
              M{matchIndex}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Detail Pertandingan Match {matchIndex}
                {projection.isOverridden && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                    Edited / Override
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Susunan pemain &amp; input shuttlecock terpisah per lapangan (Court 1 &amp; Court 2).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Toggle & Keterangan Status */}
          <div className="flex flex-wrap items-center justify-between bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 gap-2">
            <span className="text-xs text-slate-300 font-medium px-1">
              Status Formasi:{" "}
              <strong className={projection.isOverridden ? "text-amber-400" : "text-emerald-400"}>
                {projection.isOverridden ? "Manual Override" : "Otomatis (Rekomendasi Sistem)"}
              </strong>
            </span>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isEditMode
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              }`}
            >
              {isEditMode ? "Tutup Mode Edit" : "✏️ Edit Formasi Manual"}
            </button>
          </div>

          {/* Court 1 Card */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-black rounded-bl-xl border-b border-l border-emerald-500/30">
              COURT 1
            </div>

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Lapangan 1 (Ganda)
              </h4>
            </div>

            {isEditMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Tim A (Court 1)</div>
                  <select
                    value={editC1A1}
                    onChange={(e) => setEditC1A1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 1 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editC1A2}
                    onChange={(e) => setEditC1A2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 2 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Tim B (Court 1)</div>
                  <select
                    value={editC1B1}
                    onChange={(e) => setEditC1B1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 1 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editC1B2}
                    onChange={(e) => setEditC1B2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 2 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : projection.court1 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-xs text-slate-400 font-semibold mb-1">
                    TIM A (Level: {projection.court1.teamALevel})
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                    {playerMap.get(projection.court1.teamA.player1Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court1.teamA.player1Id)?.name}</span>
                    <span className="text-emerald-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court1.teamA.player1Id)?.level}]
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                    {playerMap.get(projection.court1.teamA.player2Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court1.teamA.player2Id)?.name}</span>
                    <span className="text-emerald-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court1.teamA.player2Id)?.level}]
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black">
                    VS
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      projection.court1.levelDiff <= 2
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    Δ {projection.court1.levelDiff} Lvl {projection.court1.levelDiff <= 2 ? "✓" : "⚠️"}
                  </span>
                </div>

                <div className="flex-1 text-center sm:text-right">
                  <div className="text-xs text-slate-400 font-semibold mb-1">
                    TIM B (Level: {projection.court1.teamBLevel})
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                    {playerMap.get(projection.court1.teamB.player1Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court1.teamB.player1Id)?.name}</span>
                    <span className="text-emerald-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court1.teamB.player1Id)?.level}]
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                    {playerMap.get(projection.court1.teamB.player2Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court1.teamB.player2Id)?.name}</span>
                    <span className="text-emerald-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court1.teamB.player2Id)?.level}]
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                Pemain aktif kurang dari 4 orang untuk Court 1.
              </div>
            )}

            {/* Input Shuttlecock Khusus Lapangan 1 */}
            <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">🏸</span>
                <div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>Shuttlecock Court 1</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Rp {(c1Cock * 3000).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Dikenakan kepada pemain reguler yang bertanding di Court 1
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCourtShuttlecock(
                      matchIndex,
                      "court1",
                      Math.max(0, c1Cock - 1)
                    )
                  }
                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition border border-slate-700"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  value={c1Cock}
                  onChange={(e) =>
                    onUpdateCourtShuttlecock(
                      matchIndex,
                      "court1",
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                  className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs font-black text-emerald-400 py-1 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCourtShuttlecock(matchIndex, "court1", c1Cock + 1)
                  }
                  className="w-7 h-7 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center text-xs transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Court 2 Card */}
          <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-black rounded-bl-xl border-b border-l border-rose-500/30">
              COURT 2
            </div>

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                Lapangan 2 (Ganda)
              </h4>
            </div>

            {isEditMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Tim A (Court 2)</div>
                  <select
                    value={editC2A1}
                    onChange={(e) => setEditC2A1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 1 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editC2A2}
                    onChange={(e) => setEditC2A2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 2 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-300">Tim B (Court 2)</div>
                  <select
                    value={editC2B1}
                    onChange={(e) => setEditC2B1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 1 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editC2B2}
                    onChange={(e) => setEditC2B2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Pemain 2 --</option>
                    {activePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isAdmin ? "👑 " : ""}{p.name} (Lvl {p.level}) - {getPlayerStatusInMatch(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : projection.court2 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-xs text-slate-400 font-semibold mb-1">
                    TIM A (Level: {projection.court2.teamALevel})
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                    {playerMap.get(projection.court2.teamA.player1Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court2.teamA.player1Id)?.name}</span>
                    <span className="text-rose-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court2.teamA.player1Id)?.level}]
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                    {playerMap.get(projection.court2.teamA.player2Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court2.teamA.player2Id)?.name}</span>
                    <span className="text-rose-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court2.teamA.player2Id)?.level}]
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black">
                    VS
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      projection.court2.levelDiff <= 2
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    Δ {projection.court2.levelDiff} Lvl {projection.court2.levelDiff <= 2 ? "✓" : "⚠️"}
                  </span>
                </div>

                <div className="flex-1 text-center sm:text-right">
                  <div className="text-xs text-slate-400 font-semibold mb-1">
                    TIM B (Level: {projection.court2.teamBLevel})
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                    {playerMap.get(projection.court2.teamB.player1Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court2.teamB.player1Id)?.name}</span>
                    <span className="text-rose-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court2.teamB.player1Id)?.level}]
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                    {playerMap.get(projection.court2.teamB.player2Id)?.isAdmin && <span>👑</span>}
                    <span>{playerMap.get(projection.court2.teamB.player2Id)?.name}</span>
                    <span className="text-rose-400 text-xs ml-1 font-mono">
                      [L{playerMap.get(projection.court2.teamB.player2Id)?.level}]
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                {activePlayers.length < 8
                  ? "Pemain aktif belum mencapai 8 orang (Court 2 tidak berjalan)."
                  : "Court 2 kosong."}
              </div>
            )}

            {/* Input Shuttlecock Khusus Lapangan 2 */}
            <div className="mt-3 pt-3 border-t border-rose-500/20 flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">🏸</span>
                <div>
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <span>Shuttlecock Court 2</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                      Rp {(c2Cock * 3000).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Dikenakan kepada pemain reguler yang bertanding di Court 2
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCourtShuttlecock(
                      matchIndex,
                      "court2",
                      Math.max(0, c2Cock - 1)
                    )
                  }
                  className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition border border-slate-700"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  value={c2Cock}
                  onChange={(e) =>
                    onUpdateCourtShuttlecock(
                      matchIndex,
                      "court2",
                      Math.max(0, parseInt(e.target.value) || 0)
                    )
                  }
                  className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs font-black text-rose-400 py-1 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCourtShuttlecock(matchIndex, "court2", c2Cock + 1)
                  }
                  className="w-7 h-7 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold flex items-center justify-center text-xs transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Waiting Players list */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
            <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
              <span>Pemain Menunggu (Bench) di Match {matchIndex}:</span>
              <span className="text-slate-400">
                {projection.waitingPlayerIds.length} orang
              </span>
            </div>
            {projection.waitingPlayerIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {projection.waitingPlayerIds.map((pId) => {
                  const p = playerMap.get(pId);
                  const wait = projection.waitCountsSnapshot[pId] || 0;
                  return (
                    <span
                      key={pId}
                      className="px-2 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1"
                    >
                      {p?.isAdmin && <span>👑</span>}
                      <span>{p?.name}</span>
                      {!p?.isAdmin && (
                        <span className="text-amber-400 font-mono text-[10px]">
                          (Tunggu {wait}x)
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">
                Semua pemain hadir bertanding di match ini.
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <div>
            {projection.isOverridden && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition"
              >
                Reset ke Rekomendasi Otomatis
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Tutup
            </button>
            {isEditMode && (
              <button
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
              >
                Simpan Formasi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL PENYESUAIAN BIAYA MANUAL / DISKON
// ============================================================================

interface EditFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  autoFee: number;
  currentFee: number;
  isCustom: boolean;
  shuttlecockCount: number;
  onSaveCustomFee: (playerId: string, fee: number) => void;
  onResetCustomFee: (playerId: string) => void;
}

const EditFeeModal: React.FC<EditFeeModalProps> = ({
  isOpen,
  onClose,
  player,
  autoFee,
  currentFee,
  isCustom,
  shuttlecockCount,
  onSaveCustomFee,
  onResetCustomFee,
}) => {
  const [feeInput, setFeeInput] = useState<number>(currentFee);

  React.useEffect(() => {
    setFeeInput(currentFee);
  }, [currentFee, isOpen]);

  if (!isOpen || !player) return null;

  const handleSave = () => {
    onSaveCustomFee(player.id, Math.max(0, feeInput));
    onClose();
  };

  const handleReset = () => {
    onResetCustomFee(player.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💰</span>
            <div>
              <h3 className="text-base font-bold text-white">
                Penyesuaian Biaya / Diskon
              </h3>
              <p className="text-xs text-slate-400">
                Pemain: <strong className="text-emerald-400">{player.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Info Biaya Otomatis */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1 text-xs">
          <div className="text-slate-400 font-medium flex justify-between">
            <span>
              {player.isAdmin ? "Status Khusus:" : "Hitungan Otomatis (11k + 3k×cock):"}
            </span>
            <span className="font-mono text-white font-bold">
              {player.isAdmin ? "Bebas Iuran (Admin)" : `Rp ${autoFee.toLocaleString("id-ID")}`}
            </span>
          </div>
          {!player.isAdmin && (
            <div className="text-slate-500 text-[11px]">
              Cock lapangan dimainkan: {shuttlecockCount} 🏸
            </div>
          )}
        </div>

        {/* Input Custom Fee */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nominal Tagihan yang Harus Dibayar (Rp):
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">
              Rp
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={feeInput}
              onChange={(e) =>
                setFeeInput(Math.max(0, parseInt(e.target.value) || 0))
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Gunakan untuk memberikan diskon, pembulatan, atau potongan khusus.
          </p>
        </div>

        {/* Quick Discount Buttons */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Pilihan Cepat Diskon:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFeeInput(Math.max(0, autoFee - 5000))}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              -Rp 5.000
            </button>
            <button
              type="button"
              onClick={() => setFeeInput(Math.max(0, autoFee - 10000))}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              -Rp 10.000
            </button>
            <button
              type="button"
              onClick={() => setFeeInput(10000)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              Pas Rp 10.000
            </button>
            <button
              type="button"
              onClick={() => setFeeInput(0)}
              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/60 transition"
            >
              Gratis (Rp 0)
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div>
            {isCustom && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-400 hover:text-rose-300 transition"
              >
                ↺ Reset ke Otomatis
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-md shadow-emerald-500/20"
            >
              Simpan Biaya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. HALAMAN UTAMA (MAIN CLIENT COMPONENT)
// ============================================================================

export default function BadmintonRotationApp() {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [projectedMatchCount, setProjectedMatchCount] = useState<number>(8);
  const [overrides, setOverrides] = useState<Record<number, MatchOverride>>({});
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number | null>(null);

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerLevel, setNewPlayerLevel] = useState<number>(3);
  const [newPlayerIsPresent, setNewPlayerIsPresent] = useState<boolean>(true);

  // State Shuttlecock per Match dan per Court
  const [matchCourtShuttlecocks, setMatchCourtShuttlecocks] = useState<
    Record<number, CourtShuttlecockData>
  >({});

  // State Biaya Manual / Diskon per Pemain (Key: playerId, Value: custom fee)
  const [customFees, setCustomFees] = useState<Record<string, number>>({});

  // State Modal Penyesuaian Biaya
  const [editingFeePlayer, setEditingFeePlayer] = useState<Player | null>(null);

  const [showPlayerManager, setShowPlayerManager] = useState<boolean>(false);

  const handleTogglePresent = useCallback((playerId: string) => {
    setPlayers((prev) => {
      const maxArrival = prev
        .filter((p) => p.isPresent)
        .reduce((max, p) => Math.max(max, p.arrivalOrder), 0);

      return prev.map((p) => {
        if (p.id !== playerId) return p;

        const nextPresent = !p.isPresent;
        return {
          ...p,
          isPresent: nextPresent,
          arrivalOrder: nextPresent ? maxArrival + 1 : 0,
        };
      });
    });
  }, []);

  const handleUpdatePlayerLevel = useCallback((playerId: string, newLevel: number) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, level: newLevel } : p))
    );
  }, []);

  const handleUpdatePlayerName = useCallback((playerId: string, newName: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, name: newName } : p))
    );
  }, []);

  // State Status Pembayaran per Pemain (Key: playerId, Value: "QRIS" | "Cash" | "")
  const [paymentStatuses, setPaymentStatuses] = useState<
    Record<string, "QRIS" | "Cash" | "">
  >({});

  const handleUpdatePaymentStatus = useCallback(
    (playerId: string, status: "QRIS" | "Cash" | "") => {
      setPaymentStatuses((prev) => ({
        ...prev,
        [playerId]: status,
      }));
    },
    []
  );

  const handleAddPlayer = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPlayerName.trim()) return;

      setPlayers((prev) => {
        const maxArrival = prev
          .filter((p) => p.isPresent)
          .reduce((max, p) => Math.max(max, p.arrivalOrder), 0);

        const newPlayer: Player = {
          id: `p_${Date.now()}`,
          name: newPlayerName.trim(),
          level: newPlayerLevel,
          isPresent: newPlayerIsPresent,
          arrivalOrder: newPlayerIsPresent ? maxArrival + 1 : 0,
        };

        return [...prev, newPlayer];
      });

      setNewPlayerName("");
      setNewPlayerLevel(3);
      setNewPlayerIsPresent(true);
    },
    [newPlayerName, newPlayerLevel, newPlayerIsPresent]
  );

  const handleDeletePlayer = useCallback((playerId: string) => {
    // Lindungi akun Admin agar tidak terhapus
    setPlayers((prev) => prev.filter((p) => p.id !== playerId || p.isAdmin));
  }, []);

  const handleResetToPreset = useCallback(() => {
    if (confirm("Reset daftar pemain ke data contoh (termasuk Admin)?")) {
      setPlayers(INITIAL_PLAYERS);
      setOverrides({});
      setMatchCourtShuttlecocks({});
      setCustomFees({});
      setPaymentStatuses({});
    }
  }, []);

  const handleClearAllOverrides = useCallback(() => {
    if (confirm("Hapus semua override manual dan kembalikan ke rotasi otomatis?")) {
      setOverrides({});
    }
  }, []);

  const handleSaveOverride = useCallback((matchIdx: number, override: MatchOverride) => {
    setOverrides((prev) => ({
      ...prev,
      [matchIdx]: override,
    }));
  }, []);

  const handleResetSingleOverride = useCallback((matchIdx: number) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[matchIdx];
      return next;
    });
  }, []);

  const handleUpdateCourtShuttlecock = useCallback(
    (matchIdx: number, court: "court1" | "court2", count: number) => {
      setMatchCourtShuttlecocks((prev) => {
        const current = prev[matchIdx] || { court1: 0, court2: 0 };
        return {
          ...prev,
          [matchIdx]: {
            ...current,
            [court]: Math.max(0, count),
          },
        };
      });
    },
    []
  );

  const handleSaveCustomFee = useCallback((playerId: string, fee: number) => {
    setCustomFees((prev) => ({
      ...prev,
      [playerId]: fee,
    }));
  }, []);

  const handleResetCustomFee = useCallback((playerId: string) => {
    setCustomFees((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }, []);

  const presentPlayers = useMemo(() => {
    return players
      .filter((p) => p.isPresent)
      .sort((a, b) => a.arrivalOrder - b.arrivalOrder);
  }, [players]);

  const projections = useMemo(() => {
    return generateMatchProjections(players, projectedMatchCount, overrides);
  }, [players, projectedMatchCount, overrides]);

  const totalSessionShuttlecocks = useMemo(() => {
    return Object.values(matchCourtShuttlecocks).reduce(
      (sum, val) => sum + (val.court1 || 0) + (val.court2 || 0),
      0
    );
  }, [matchCourtShuttlecocks]);

  /**
   * Menghitung shuttlecock & biaya per pemain:
   * - Admin: Bebas Iuran (Rp 0).
   * - Pemain Reguler: 11.000 + 3.000 * shuttlecock lapangan yang dimainkan.
   * - Diskon: Override nominal jika user memberikan diskon manual.
   */
  const playerStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        matchesPlayed: number;
        shuttlecockCount: number;
        fee: number;
        autoFee: number;
        isCustom: boolean;
        c1Count: number;
        c2Count: number;
      }
    >();

    for (const player of players) {
      if (!player.isPresent) {
        map.set(player.id, {
          matchesPlayed: 0,
          shuttlecockCount: 0,
          fee: 0,
          autoFee: 0,
          isCustom: false,
          c1Count: 0,
          c2Count: 0,
        });
        continue;
      }

      let countPlayed = 0;
      let totalPlayerShuttlecocks = 0;
      let c1Count = 0;
      let c2Count = 0;

      for (const proj of projections) {
        const court = proj.playerCourts[player.id];
        if (court === "c1") {
          countPlayed += 1;
          c1Count += 1;
          const c1Cock = matchCourtShuttlecocks[proj.matchIndex]?.court1 ?? 0;
          totalPlayerShuttlecocks += c1Cock;
        } else if (court === "c2") {
          countPlayed += 1;
          c2Count += 1;
          const c2Cock = matchCourtShuttlecocks[proj.matchIndex]?.court2 ?? 0;
          totalPlayerShuttlecocks += c2Cock;
        }
      }

      // Pemain spesial (Admin) bebas iuran (Rp 0) secara default
      const autoFee = player.isAdmin
        ? 0
        : 11000 + 3000 * totalPlayerShuttlecocks;

      const isCustom = customFees[player.id] !== undefined;
      const fee = isCustom ? customFees[player.id] : autoFee;

      map.set(player.id, {
        matchesPlayed: countPlayed,
        shuttlecockCount: totalPlayerShuttlecocks,
        fee,
        autoFee,
        isCustom,
        c1Count,
        c2Count,
      });
    }

    return map;
  }, [players, projections, matchCourtShuttlecocks, customFees]);

  const totalKas = useMemo(() => {
    let total = 0;
    for (const p of presentPlayers) {
      const pStats = playerStatsMap.get(p.id);
      if (pStats) total += pStats.fee;
    }
    return total;
  }, [presentPlayers, playerStatsMap]);

  const stats = useMemo(() => {
    const totalPresent = presentPlayers.length;
    // Pemain reguler yang aktif (tanpa admin) menentukan status lapangan otomatis
    const regularPresent = presentPlayers.filter((p) => !p.isAdmin).length;

    let courtStatus = "Belum Cukup Pemain";
    let activeCourts = 0;

    if (regularPresent >= 8) {
      courtStatus = "2 Lapangan (8 Main, " + (regularPresent - 8) + " Menunggu)";
      activeCourts = 2;
    } else if (regularPresent >= 4) {
      courtStatus = "1 Lapangan (4 Main, " + (regularPresent - 4) + " Menunggu)";
      activeCourts = 1;
    } else {
      courtStatus = "Kurang " + (4 - regularPresent) + " Orang Lagi";
    }

    const overrideCount = Object.keys(overrides).length;
    const customFeeCount = Object.keys(customFees).length;

    let qrisPaidCount = 0;
    let cashPaidCount = 0;
    for (const p of presentPlayers) {
      if (!p.isAdmin) {
        if (paymentStatuses[p.id] === "QRIS") qrisPaidCount++;
        else if (paymentStatuses[p.id] === "Cash") cashPaidCount++;
      }
    }
    const totalPaidCount = qrisPaidCount + cashPaidCount;

    return {
      totalPresent,
      courtStatus,
      activeCourts,
      overrideCount,
      customFeeCount,
      regularPresent,
      qrisPaidCount,
      cashPaidCount,
      totalPaidCount,
    };
  }, [presentPlayers, overrides, customFees, paymentStatuses]);

  const selectedProjection = useMemo(() => {
    if (!selectedMatchIdx) return null;
    return projections.find((p) => p.matchIndex === selectedMatchIdx) || null;
  }, [selectedMatchIdx, projections]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* =====================================================================
          HEADER & BRANDING
      ====================================================================== */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
              🏸
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                DaySmash
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                  Badminton Rotation
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Sistem rotasi ganda otomatis, pemain spesial Admin, live level editor &amp; iuran
              </p>
            </div>
          </div>

          {/* Quick Actions & Setting Proyeksi */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
              <label htmlFor="projection-input" className="text-xs text-slate-400 mr-2 font-medium">Proyeksi:</label>
              <input
                id="projection-input"
                type="number"
                min={1}
                max={18}
                value={projectedMatchCount}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(18, Number(e.target.value) || 1));
                  setProjectedMatchCount(val);
                }}
                className="w-12 bg-slate-900 border border-slate-700 rounded-lg text-center text-xs font-bold text-white py-1 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-500 ml-1.5 font-medium">Match</span>
            </div>

            <button
              onClick={() => setShowPlayerManager(!showPlayerManager)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                showPlayerManager
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>👥 Kelola Pemain</span>
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-mono flex items-center justify-center">
                {players.length}
              </span>
            </button>

            {stats.overrideCount > 0 && (
              <button
                onClick={handleClearAllOverrides}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition flex items-center gap-1.5"
              >
                <span>Reset {stats.overrideCount} Override</span>
              </button>
            )}

            {stats.customFeeCount > 0 && (
              <button
                onClick={() => setCustomFees({})}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition flex items-center gap-1.5"
                title="Reset semua penyesuaian biaya/diskon ke otomatis"
              >
                <span>Reset {stats.customFeeCount} Diskon</span>
              </button>
            )}

            <button
              onClick={handleResetToPreset}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
              title="Reset ke daftar 12 pemain preset"
            >
              Data Contoh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ===================================================================
            KPI & STATUS BAR
        ==================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* KPI 1: Pemain Hadir */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
              ✓
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Pemain Hadir (Aktif)
              </div>
              <div className="text-xl font-black text-white">
                {stats.totalPresent}{" "}
                <span className="text-xs font-normal text-slate-400">
                  / {players.length} Terdaftar
                </span>
              </div>
              <div className="text-[10px] text-purple-400 font-semibold flex items-center gap-1">
                <span>👑 1 Admin Host</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Status Lapangan */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl font-bold ${
                stats.activeCourts === 2
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                  : stats.activeCourts === 1
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/50 border-slate-700 text-slate-500"
              }`}
            >
              🏸
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Status Lapangan (Otomatis)
              </div>
              <div className="text-sm font-bold text-white truncate max-w-[180px]">
                {stats.courtStatus}
              </div>
            </div>
          </div>

          {/* KPI 3: Total Shuttlecock & Kas Tagihan */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold">
              💰
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Iuran Kas Mabar
              </div>
              <div className="text-xl font-black text-emerald-400 flex items-center gap-2">
                <span>Rp {totalKas.toLocaleString("id-ID")}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                <span>{totalSessionShuttlecocks} Cock terpakai</span>
                <span className="text-emerald-400 font-bold">
                  · Bayar: {stats.totalPaidCount}/{stats.regularPresent} (📱{stats.qrisPaidCount} QRIS, 💵{stats.cashPaidCount} Cash)
                </span>
              </div>
            </div>
          </div>

          {/* KPI 4: Petunjuk Pemain Spesial Admin */}
          <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-4 flex flex-col justify-center gap-1 shadow-sm bg-purple-950/10">
            <div className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <span>👑 Pemain Spesial (Admin)</span>
            </div>
            <div className="text-xs text-slate-300">
              Hanya main jika di-setting manual pada match.
            </div>
            <div className="text-[11px] text-purple-400 font-semibold">
              Bebas iuran &amp; level bisa diubah real-time!
            </div>
          </div>
        </div>

        {/* ===================================================================
            DRAWER / PANEL KELOLA PEMAIN (TAMBAH, LEVEL, & UBAH STATUS)
        ==================================================================== */}
        {showPlayerManager && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>👥 Manajemen Daftar Pemain, Kehadiran &amp; Rincian Biaya</span>
              </h2>
              <span className="text-xs text-slate-400">
                Ubah nama, level atau biaya manual langsung pada baris pemain di bawah ini.
              </span>
            </div>

            {/* Form Tambah Pemain Baru */}
            <form
              onSubmit={handleAddPlayer}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Nama Pemain
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Taufik Hidayat"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="w-28">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Level (1 - 5)
                </label>
                <select
                  value={newPlayerLevel}
                  onChange={(e) => setNewPlayerLevel(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={5}>Lvl 5 (Mahir)</option>
                  <option value={4}>Lvl 4 (Atas)</option>
                  <option value={3}>Lvl 3 (Menengah)</option>
                  <option value={2}>Lvl 2 (Dasar)</option>
                  <option value={1}>Lvl 1 (Pemula)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id="new-present"
                  checked={newPlayerIsPresent}
                  onChange={(e) => setNewPlayerIsPresent(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 accent-emerald-500"
                />
                <label
                  htmlFor="new-present"
                  className="text-xs font-medium text-slate-300 cursor-pointer"
                >
                  Langsung Hadir
                </label>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition shadow-lg shadow-emerald-500/20"
              >
                + Tambah Pemain
              </button>
            </form>

            {/* Tabel Daftar Pemain Terdaftar */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 w-16 text-center">Hadir</th>
                    <th className="py-2.5 px-4 w-20 text-center">Urutan</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Nama Pemain (Live Edit)</th>
                    <th className="py-2.5 px-4 w-36 text-center">Level (Live Edit)</th>
                    <th className="py-2.5 px-4 w-32 text-center">Main / Cock</th>
                    <th className="py-2.5 px-4 w-40 text-right">Biaya Bayar (Edit)</th>
                    <th className="py-2.5 px-4 w-20 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {players.map((player) => {
                    const pStats = playerStatsMap.get(player.id);
                    return (
                      <tr
                        key={player.id}
                        className={`hover:bg-slate-800/40 transition ${
                          player.isAdmin
                            ? "bg-purple-950/20 border-l-2 border-purple-500"
                            : player.isPresent
                            ? "bg-emerald-950/10"
                            : "opacity-60"
                        }`}
                      >
                        <td className="py-2 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={player.isPresent}
                            onChange={() => handleTogglePresent(player.id)}
                            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                          {player.isPresent ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold ${
                                player.isAdmin
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : "bg-emerald-500/20 text-emerald-400"
                              }`}
                            >
                              #{player.arrivalOrder}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4 font-semibold text-white">
                          <div className="flex items-center gap-1.5">
                            {player.isAdmin && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black shrink-0">
                                👑 ADMIN
                              </span>
                            )}
                            <div className="relative flex-1 min-w-[150px]">
                              <input
                                type="text"
                                value={player.name}
                                onChange={(e) =>
                                  handleUpdatePlayerName(player.id, e.target.value)
                                }
                                className="w-full bg-slate-900/80 hover:bg-slate-900 focus:bg-slate-950 border border-slate-700 hover:border-slate-500 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none transition shadow-inner"
                                placeholder="Nama pemain..."
                                title="Klik untuk mengedit nama pemain langsung"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <select
                            value={player.level}
                            onChange={(e) =>
                              handleUpdatePlayerLevel(
                                player.id,
                                Number(e.target.value)
                              )
                            }
                            className="bg-slate-900 border border-slate-700 hover:border-emerald-500 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none cursor-pointer transition"
                            title="Ubah level pemain (otomatis menghitung ulang match berikutnya secara real-time)"
                          >
                            <option value={5}>Level 5 (Mahir)</option>
                            <option value={4}>Level 4 (Atas)</option>
                            <option value={3}>Level 3 (Menengah)</option>
                            <option value={2}>Level 2 (Dasar)</option>
                            <option value={1}>Level 1 (Pemula)</option>
                          </select>
                        </td>
                        <td className="py-2 px-4 text-center font-mono text-slate-300">
                          {player.isPresent ? (
                            <span>
                              {pStats?.matchesPlayed || 0}m /{" "}
                              <strong className="text-emerald-400 font-bold">
                                {pStats?.shuttlecockCount || 0}🏸
                              </strong>
                              <span className="text-[10px] text-slate-500 block">
                                (c1: {pStats?.c1Count || 0}, c2: {pStats?.c2Count || 0})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold">
                          {player.isAdmin ? (
                            <div className="flex flex-col items-end">
                              <span className="text-purple-400 text-xs font-black">
                                {pStats?.isCustom
                                  ? `Rp ${pStats?.fee.toLocaleString("id-ID")}`
                                  : "GRATIS (Host)"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                Bebas Iuran
                              </span>
                            </div>
                          ) : player.isPresent ? (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingFeePlayer(player)}
                                  className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 transition"
                                  title="Klik untuk ubah biaya manual / beri diskon"
                                >
                                  <span>Rp {pStats?.fee.toLocaleString("id-ID")}</span>
                                  <span className="text-[10px] text-slate-500">✏️</span>
                                </button>
                                {pStats?.isCustom && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                                    Diskon
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-normal">
                                {pStats?.isCustom
                                  ? `Auto: Rp ${pStats?.autoFee.toLocaleString("id-ID")}`
                                  : `11k + 3k×${pStats?.shuttlecockCount}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">
                              - (Tidak Hadir)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {player.isAdmin ? (
                            <span className="text-slate-600 text-xs select-none" title="Admin tidak dapat dihapus">
                              🔒
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDeletePlayer(player.id)}
                              className="text-slate-400 hover:text-rose-400 transition text-xs p-1"
                              title="Hapus Pemain"
                            >
                              🗑️
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAMPILAN UTAMA: SPREADSHEET VIEW
        ==================================================================== */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header Tabel Spreadsheet */}
          <div className="p-4 sm:px-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📊 Jadwal Pertandingan (Spreadsheet View)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Admin (<strong className="text-purple-400">👑</strong>) hanya bermain jika di-setting manual di modal match. Level &amp; biaya pemain dapat diedit langsung.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Total Cock:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {totalSessionShuttlecocks} Cock
                </span>
              </div>
            </div>
          </div>

          {/* Kontainer Tabel dengan Horizontal Scroll & Sticky Column */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-300">
                  {/* Sumbu Y Header: Sticky Left Column */}
                  <th className="sticky left-0 z-20 bg-slate-950 py-3.5 px-3 min-w-[330px] sm:min-w-[380px] border-r border-slate-800 shadow-md">
                    <div className="text-xs font-black tracking-wider text-slate-400 uppercase">
                      Pemain, Level, Bayar &amp; Biaya (Sumbu Y)
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Nama &amp; Level live edit · Status: QRIS / Cash / Kosong
                    </div>
                  </th>

                  {/* Sumbu X Header: Kolom Match M1, M2, dst */}
                  {projections.map((proj) => {
                    const c1Val = matchCourtShuttlecocks[proj.matchIndex]?.court1 ?? 0;
                    const c2Val = matchCourtShuttlecocks[proj.matchIndex]?.court2 ?? 0;

                    return (
                      <th
                        key={proj.matchIndex}
                        onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                        className="py-2 px-2 text-center border-r border-slate-800/80 min-w-[95px] cursor-pointer hover:bg-slate-800/80 transition-colors group select-none"
                        title="Klik untuk melihat detail atau edit formasi match ini"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-black text-emerald-400 group-hover:text-emerald-300 font-mono flex items-center gap-1">
                            M{proj.matchIndex}
                            {proj.isOverridden && (
                              <span className="text-[10px] text-amber-400" title="Override aktif">
                                ✏️
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                            {proj.isOverridden ? "Manual" : "Auto"}
                          </span>

                          {/* Input Shuttlecock per Lapangan (c1 & c2) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 flex flex-col items-center gap-1 w-full"
                          >
                            <div
                              className="flex items-center justify-between gap-1 bg-emerald-950/50 border border-emerald-500/30 rounded px-1.5 py-0.5 w-full hover:border-emerald-500/70 transition"
                              title={`Shuttlecock Lapangan 1 di Match ${proj.matchIndex}`}
                            >
                              <span className="text-[9px] font-black text-emerald-400 font-mono">c1</span>
                              <input
                                type="number"
                                min={0}
                                value={c1Val}
                                onChange={(e) =>
                                  handleUpdateCourtShuttlecock(
                                    proj.matchIndex,
                                    "court1",
                                    Math.max(0, parseInt(e.target.value) || 0)
                                  )
                                }
                                className="w-6 bg-transparent text-right text-[10px] font-black text-emerald-300 focus:outline-none cursor-text"
                              />
                            </div>

                            {(presentPlayers.filter((p) => !p.isAdmin).length >= 8 || proj.court2 !== null) && (
                              <div
                                className="flex items-center justify-between gap-1 bg-rose-950/50 border border-rose-500/30 rounded px-1.5 py-0.5 w-full hover:border-rose-500/70 transition"
                                title={`Shuttlecock Lapangan 2 di Match ${proj.matchIndex}`}
                              >
                                <span className="text-[9px] font-black text-rose-400 font-mono">c2</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={c2Val}
                                  onChange={(e) =>
                                    handleUpdateCourtShuttlecock(
                                      proj.matchIndex,
                                      "court2",
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  className="w-6 bg-transparent text-right text-[10px] font-black text-rose-300 focus:outline-none cursor-text"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {presentPlayers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={projectedMatchCount + 1}
                      className="py-12 text-center text-slate-400 italic text-sm"
                    >
                      Belum ada pemain yang berstatus hadir. Buka panel &quot;Kelola Pemain&quot; di atas untuk mencentang kehadiran.
                    </td>
                  </tr>
                ) : (
                  presentPlayers.map((player) => {
                    const pStats = playerStatsMap.get(player.id);
                    const fee = pStats?.fee || 0;
                    const isCustom = pStats?.isCustom || false;
                    const cocksUsed = pStats?.shuttlecockCount || 0;
                    const totalPlayed = pStats?.matchesPlayed || 0;

                    return (
                      <tr
                        key={player.id}
                        className={`hover:bg-slate-800/30 transition-colors ${
                          player.isAdmin ? "bg-purple-950/10" : ""
                        }`}
                      >
                        {/* Kolom Sticky Pemain (Sumbu Y) */}
                        <td className="sticky left-0 z-10 bg-slate-900 py-2 px-3 border-r border-slate-800 flex items-center justify-between gap-2 shadow-md">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span
                              className={`w-5 h-5 rounded-full text-[10px] font-mono flex items-center justify-center font-bold shrink-0 ${
                                player.isAdmin
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              #{player.arrivalOrder}
                            </span>
                            <div className="truncate">
                              <div className="flex items-center gap-1">
                                {player.isAdmin && (
                                  <span className="text-purple-400 shrink-0 text-xs" title="Admin / Host">
                                    👑
                                  </span>
                                )}
                                <input
                                  type="text"
                                  value={player.name}
                                  onChange={(e) =>
                                    handleUpdatePlayerName(player.id, e.target.value)
                                  }
                                  className="bg-slate-950/40 hover:bg-slate-950/80 focus:bg-slate-950 border border-transparent hover:border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs font-bold text-white focus:outline-none transition w-[110px] sm:w-[135px] truncate"
                                  title="Klik untuk langsung mengubah nama pemain di sini"
                                  placeholder="Nama pemain..."
                                />
                              </div>
                              {/* Rincian Biaya per Profile */}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {player.isAdmin ? (
                                  <span className="text-[10px] text-purple-400 font-mono font-bold">
                                    Bebas Iuran (Admin)
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setEditingFeePlayer(player)}
                                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-bold flex items-center gap-1 transition"
                                      title="Klik untuk ubah biaya manual / beri diskon"
                                    >
                                      <span>Rp {fee.toLocaleString("id-ID")}</span>
                                      <span className="text-[10px] text-slate-500 hover:text-white">✏️</span>
                                    </button>
                                    {isCustom && (
                                      <span
                                        className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer"
                                        onClick={() => setEditingFeePlayer(player)}
                                        title="Biaya ini telah disesuaikan manual"
                                      >
                                        Diskon
                                      </span>
                                    )}
                                    <span className="text-slate-500 font-normal text-[10px]">
                                      ({cocksUsed} 🏸)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Status Pembayaran Dropdown (QRIS / Cash / Belum) */}
                            {player.isAdmin ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                                Host
                              </span>
                            ) : (
                              <select
                                value={paymentStatuses[player.id] || ""}
                                onChange={(e) =>
                                  handleUpdatePaymentStatus(
                                    player.id,
                                    e.target.value as "QRIS" | "Cash" | ""
                                  )
                                }
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono border focus:outline-none cursor-pointer transition ${
                                  paymentStatuses[player.id] === "QRIS"
                                    ? "bg-sky-500/20 text-sky-300 border-sky-500/50 hover:bg-sky-500/30"
                                    : paymentStatuses[player.id] === "Cash"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30"
                                    : "bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700"
                                }`}
                                title="Status Pembayaran: QRIS, Cash, atau Kosong (Belum Bayar)"
                              >
                                <option value="" className="bg-slate-900 text-slate-400 font-normal">
                                  - Belum -
                                </option>
                                <option value="QRIS" className="bg-slate-900 text-sky-400 font-bold">
                                  QRIS
                                </option>
                                <option value="Cash" className="bg-slate-900 text-emerald-400 font-bold">
                                  Cash
                                </option>
                              </select>
                            )}

                            {/* Live Level Editor Dropdown */}
                            <select
                              value={player.level}
                              onChange={(e) =>
                                handleUpdatePlayerLevel(
                                  player.id,
                                  Number(e.target.value)
                                )
                              }
                              className={`px-1 py-0.5 rounded text-[10px] font-black font-mono border focus:outline-none cursor-pointer transition ${
                                player.isAdmin
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                                  : player.level >= 4
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  : player.level === 3
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                              }`}
                              title="Ubah level pemain (otomatis menghitung ulang match berikutnya secara real-time)"
                            >
                              <option value={5} className="bg-slate-900 text-white font-bold">L5</option>
                              <option value={4} className="bg-slate-900 text-white font-bold">L4</option>
                              <option value={3} className="bg-slate-900 text-white font-bold">L3</option>
                              <option value={2} className="bg-slate-900 text-white font-bold">L2</option>
                              <option value={1} className="bg-slate-900 text-white font-bold">L1</option>
                            </select>

                            {/* Total Main Badge */}
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300"
                              title={`Bermain ${totalPlayed} kali dari ${projectedMatchCount} match`}
                            >
                              {totalPlayed}m
                            </span>
                          </div>
                        </td>

                        {/* Sel Kolom Match (Sumbu X) */}
                        {projections.map((proj) => {
                          const court = proj.playerCourts[player.id];

                          return (
                            <td
                              key={proj.matchIndex}
                              onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                              className="py-2 px-2 text-center border-r border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors"
                            >
                              {court === "c1" ? (
                                <span className="inline-block px-2.5 py-1 rounded-md text-xs font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/40">
                                  c1
                                </span>
                              ) : court === "c2" ? (
                                <span className="inline-block px-2.5 py-1 rounded-md text-xs font-black tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950/40">
                                  c2
                                </span>
                              ) : (
                                <span className="text-slate-700 select-none font-black text-xs">
                                  -
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Spreadsheet */}
          <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <span>👑 Pemain Admin: Hanya bermain jika di-setting manual pada match</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Prioritas 1: Zero Starvation (tidak ada tunggu &gt; 2 match berturut-turut)</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              💡 Formasi manual Admin otomatis tercatat ke riwayat partner &amp; lawan match berikutnya.
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          MODAL DETAIL MATCH & MANUAL OVERRIDE
      ====================================================================== */}
      <MatchDetailModal
        isOpen={selectedMatchIdx !== null}
        onClose={() => setSelectedMatchIdx(null)}
        matchIndex={selectedMatchIdx || 1}
        projection={selectedProjection}
        activePlayers={presentPlayers}
        allPlayers={players}
        onSaveOverride={handleSaveOverride}
        onResetOverride={handleResetSingleOverride}
        courtShuttlecocks={
          selectedMatchIdx !== null
            ? matchCourtShuttlecocks[selectedMatchIdx] || { court1: 0, court2: 0 }
            : { court1: 0, court2: 0 }
        }
        onUpdateCourtShuttlecock={handleUpdateCourtShuttlecock}
      />

      {/* =====================================================================
          MODAL EDIT BIAYA PEMAIN MANUAL / DISKON
      ====================================================================== */}
      <EditFeeModal
        isOpen={editingFeePlayer !== null}
        onClose={() => setEditingFeePlayer(null)}
        player={editingFeePlayer}
        autoFee={
          editingFeePlayer ? playerStatsMap.get(editingFeePlayer.id)?.autoFee || 0 : 0
        }
        currentFee={
          editingFeePlayer ? playerStatsMap.get(editingFeePlayer.id)?.fee || 0 : 0
        }
        isCustom={
          editingFeePlayer
            ? customFees[editingFeePlayer.id] !== undefined
            : false
        }
        shuttlecockCount={
          editingFeePlayer
            ? playerStatsMap.get(editingFeePlayer.id)?.shuttlecockCount || 0
            : 0
        }
        onSaveCustomFee={handleSaveCustomFee}
        onResetCustomFee={handleResetCustomFee}
      />
    </div>
  );
}
