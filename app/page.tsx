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
  courtNumber: number; // 1, 2, 3, 4, 5
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
  courts: (CourtMatch | null)[]; // Seluruh lapangan yang aktif (1 sampai 5)
  court1: CourtMatch | null;
  court2: CourtMatch | null;
  court3?: CourtMatch | null;
  court4?: CourtMatch | null;
  court5?: CourtMatch | null;
  playingPlayerIds: Set<string>;
  waitingPlayerIds: string[];
  isOverridden: boolean;
  isCompleted?: boolean;
  playerCourts: Record<string, string | null>; // "c1" | "c2" | "c3" | "c4" | "c5" | null
  // Snapshot statistik pada match ini untuk keperluan audit/UI
  waitCountsSnapshot: Record<string, number>;
  matchesPlayedSnapshot: Record<string, number>;
}

/**
 * Data Match Selesai (Terkunci)
 */
export interface CompletedMatchInfo {
  matchIndex: number;
  courts: (CourtMatch | null)[];
  playingPlayerIds: string[];
  waitingPlayerIds: string[];
  completedAt?: string;
}

/**
 * Data Override Manual oleh User
 */
export interface MatchOverride {
  courts?: Record<number, { teamA: [string, string]; teamB: [string, string] } | null>;
  court1?: { teamA: [string, string]; teamB: [string, string] } | null;
  court2?: { teamA: [string, string]; teamB: [string, string] } | null;
  court3?: { teamA: [string, string]; teamB: [string, string] } | null;
  court4?: { teamA: [string, string]; teamB: [string, string] } | null;
  court5?: { teamA: [string, string]; teamB: [string, string] } | null;
}

/**
 * Data Shuttlecock per Lapangan pada tiap Match (misal: court1: 2, court2: 1, ...)
 */
export type CourtShuttlecockData = Record<string, number>;

/**
 * Konfigurasi Tema Warna & Identitas Lapangan (C1 - C5)
 */
export const COURT_THEMES: Record<
  number,
  {
    name: string;
    key: string;
    code: string;
    badgeClass: string;
    borderClass: string;
    textClass: string;
    bgHeaderClass: string;
    bgSubtleClass: string;
    accentBg: string;
    accentHover: string;
    accentText: string;
  }
> = {
  1: {
    name: "Lapangan 1",
    key: "court1",
    code: "c1",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-400",
    bgHeaderClass: "bg-emerald-500/20 text-emerald-400",
    bgSubtleClass: "bg-emerald-950/50 border-emerald-500/30",
    accentBg: "bg-emerald-500",
    accentHover: "hover:bg-emerald-400",
    accentText: "text-slate-950",
  },
  2: {
    name: "Lapangan 2",
    key: "court2",
    code: "c2",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-950/40",
    borderClass: "border-rose-500/30",
    textClass: "text-rose-400",
    bgHeaderClass: "bg-rose-500/20 text-rose-400",
    bgSubtleClass: "bg-rose-950/50 border-rose-500/30",
    accentBg: "bg-rose-500",
    accentHover: "hover:bg-rose-400",
    accentText: "text-slate-950",
  },
  3: {
    name: "Lapangan 3",
    key: "court3",
    code: "c3",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-950/40",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-400",
    bgHeaderClass: "bg-amber-500/20 text-amber-400",
    bgSubtleClass: "bg-amber-950/50 border-amber-500/30",
    accentBg: "bg-amber-500",
    accentHover: "hover:bg-amber-400",
    accentText: "text-slate-950",
  },
  4: {
    name: "Lapangan 4",
    key: "court4",
    code: "c4",
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sky-950/40",
    borderClass: "border-sky-500/30",
    textClass: "text-sky-400",
    bgHeaderClass: "bg-sky-500/20 text-sky-400",
    bgSubtleClass: "bg-sky-950/50 border-sky-500/30",
    accentBg: "bg-sky-500",
    accentHover: "hover:bg-sky-400",
    accentText: "text-slate-950",
  },
  5: {
    name: "Lapangan 5",
    key: "court5",
    code: "c5",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-950/40",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-400",
    bgHeaderClass: "bg-purple-500/20 text-purple-400",
    bgSubtleClass: "bg-purple-950/50 border-purple-500/30",
    accentBg: "bg-purple-500",
    accentHover: "hover:bg-purple-400",
    accentText: "text-slate-950",
  },
};

// ============================================================================
// 2. DATA AWAL CONTOH (NAMA PEMAIN A, B, C, D... BESERTA ADMIN / HOST)
// ============================================================================

export const INITIAL_PLAYERS: Player[] = [
  // Pemain Spesial (Admin / Host / User itu sendiri)
  {
    id: "admin",
    name: "Admin (Host)",
    level: 3,
    isPresent: true,
    arrivalOrder: 1,
    isAdmin: true,
  },
  // Daftar Pemain Reguler (A, B, C, D... hingga 22 pemain untuk mencukupi hingga 5 lapangan)
  { id: "p1", name: "A", level: 5, isPresent: true, arrivalOrder: 2 },
  { id: "p2", name: "B", level: 5, isPresent: true, arrivalOrder: 3 },
  { id: "p3", name: "C", level: 5, isPresent: true, arrivalOrder: 4 },
  { id: "p4", name: "D", level: 5, isPresent: true, arrivalOrder: 5 },
  { id: "p5", name: "E", level: 4, isPresent: true, arrivalOrder: 6 },
  { id: "p6", name: "F", level: 4, isPresent: true, arrivalOrder: 7 },
  { id: "p7", name: "G", level: 4, isPresent: true, arrivalOrder: 8 },
  { id: "p8", name: "H", level: 4, isPresent: true, arrivalOrder: 9 },
  { id: "p9", name: "I", level: 4, isPresent: true, arrivalOrder: 10 },
  { id: "p10", name: "J", level: 4, isPresent: true, arrivalOrder: 11 },
  { id: "p11", name: "K", level: 3, isPresent: true, arrivalOrder: 12 },
  { id: "p12", name: "L", level: 3, isPresent: true, arrivalOrder: 13 },
  { id: "p13", name: "M", level: 3, isPresent: true, arrivalOrder: 14 },
  { id: "p14", name: "N", level: 3, isPresent: true, arrivalOrder: 15 },
  { id: "p15", name: "O", level: 3, isPresent: true, arrivalOrder: 16 },
  { id: "p16", name: "P", level: 3, isPresent: true, arrivalOrder: 17 },
  { id: "p17", name: "Q", level: 2, isPresent: true, arrivalOrder: 18 },
  { id: "p18", name: "R", level: 2, isPresent: true, arrivalOrder: 19 },
  { id: "p19", name: "S", level: 2, isPresent: true, arrivalOrder: 20 },
  { id: "p20", name: "T", level: 2, isPresent: true, arrivalOrder: 21 },
  { id: "p21", name: "U", level: 1, isPresent: true, arrivalOrder: 22 },
  { id: "p22", name: "V", level: 1, isPresent: true, arrivalOrder: 23 },
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

  // Aturan 1: Tidak ada pasangan yang sama
  // Pasangan yang sama di match berurutan dicegah ketat (penalti 7000)
  const checkPartner = (p1: Player, p2: Player) => {
    const list = partnerHistory.get(p1.id)?.get(p2.id) || [];
    const count = list.length;
    if (count > 0) {
      const lastMatch = list[list.length - 1];
      if (lastMatch === currentMatchIndex - 1) {
        penalty += 7000;
      } else if (lastMatch === currentMatchIndex - 2) {
        penalty += 1200;
      }
      penalty += count * 400;
    }
  };

  // Repetisi lawan diberi bobot lebih ringan agar rotasi partner/musuh tidak mengorbankan kesetaraan level
  const checkOpponent = (p1: Player, p2: Player) => {
    const list = opponentHistory.get(p1.id)?.get(p2.id) || [];
    const count = list.length;
    if (count > 0) {
      const lastMatch = list[list.length - 1];
      if (lastMatch === currentMatchIndex - 1) {
        penalty += 120;
      } else if (lastMatch === currentMatchIndex - 2) {
        penalty += 40;
      }
      penalty += count * 30;
    }
  };

  checkPartner(teamA[0], teamA[1]);
  checkPartner(teamB[0], teamB[1]);

  checkOpponent(teamA[0], teamB[0]);
  checkOpponent(teamA[0], teamB[1]);
  checkOpponent(teamA[1], teamB[0]);
  checkOpponent(teamA[1], teamB[1]);

  // Aturan 2: Di lapangan tersebut tidak lebih dari 3 orang yang sama dari match sebelumnya
  // Jika keempat pemain di lapangan ini semuanya bermain bersama di match m-1, berikan penalti tinggi
  if (currentMatchIndex > 1) {
    const allFour = [teamA[0], teamA[1], teamB[0], teamB[1]];
    let sameCourtPairsCount = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const p1 = allFour[i].id;
        const p2 = allFour[j].id;
        const partList = partnerHistory.get(p1)?.get(p2) || [];
        const oppList = opponentHistory.get(p1)?.get(p2) || [];
        if (
          partList.includes(currentMatchIndex - 1) ||
          oppList.includes(currentMatchIndex - 1)
        ) {
          sameCourtPairsCount++;
        }
      }
    }
    // Jika keempatnya bersama di lapangan pada match sebelumnya, ada 6 pasangan antar pemain
    if (sameCourtPairsCount >= 6) {
      penalty += 5000;
    }
  }

  const levelTeamA = teamA[0].level + teamA[1].level;
  const levelTeamB = teamB[0].level + teamB[1].level;
  const levelGap = Math.abs(levelTeamA - levelTeamB);

  // Aturan 3: Prioritas Leveling ("Semakin seimbang semakin baik")
  // Selagi tidak lebih dari 3 orang yang sama dan tidak ada pasangan yang sama:
  // - levelGap === 0: Prioritas sempurna (penalty 0)
  // - levelGap === 1: penalty 800 (mengunggulkan rotasi partner/lawan dengan level seimbang)
  // - levelGap === 2: penalty 2000
  // - levelGap > 2: Batas keras selisih maksimal 2 (penalti masif 25.000+)
  if (levelGap === 0) {
    penalty += 0;
  } else if (levelGap === 1) {
    penalty += 800;
  } else if (levelGap === 2) {
    penalty += 2000;
  } else {
    penalty += 25000 + (levelGap - 2) * 10000;
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
 * Optimasi Pengelompokan & Pasangan untuk 3, 4, atau 5 Lapangan (Multi-Court)
 * 
 * Strategi:
 * 1. Urutkan pemain berdasarkan level descending (5 -> 1) lalu partisi awal per jenjang (tiering),
 *    menjamin pasangan dan lawan pada setiap lapangan memiliki tingkat kemampuan setara (levelGap <= 2).
 * 2. Lakukan optimasi pertukaran lokal (2-opt swap) antar lapangan untuk mencari kombinasi
 *    rotasi partner & musuh paling segar tanpa merusak kesetaraan level.
 */
function optimizeMultiCourtPairings(
  selectedPlayers: Player[],
  courtCount: number,
  currentMatchIndex: number,
  partnerHistory: Map<string, Map<string, number[]>>,
  opponentHistory: Map<string, Map<string, number[]>>
): Array<{ teamA: [Player, Player]; teamB: [Player, Player] }> {
  const sorted = [...selectedPlayers].sort((a, b) => b.level - a.level);

  // Inisialisasi awal berjenjang: Court 0 dapat 4 teratas, Court 1 dapat 4 berikutnya, dst.
  const courtGroups: Player[][] = [];
  for (let c = 0; c < courtCount; c++) {
    courtGroups.push(sorted.slice(c * 4, c * 4 + 4));
  }

  let bestCourts = courtGroups;
  let bestCourtOpt = bestCourts.map((group) =>
    optimizeCourtPairing(
      group as [Player, Player, Player, Player],
      currentMatchIndex,
      partnerHistory,
      opponentHistory
    )
  );
  let bestTotalPenalty = bestCourtOpt.reduce((sum, c) => sum + c.penalty, 0);

  // 2-opt swaps antar lapangan
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 8) {
    improved = false;
    iterations++;

    for (let cA = 0; cA < courtCount; cA++) {
      for (let cB = cA + 1; cB < courtCount; cB++) {
        for (let pAIdx = 0; pAIdx < 4; pAIdx++) {
          for (let pBIdx = 0; pBIdx < 4; pBIdx++) {
            const playerA = bestCourts[cA][pAIdx];
            const playerB = bestCourts[cB][pBIdx];

            // Hanya pertimbangkan tukar jika selisih level pemain <= 1
            if (Math.abs(playerA.level - playerB.level) > 1) continue;

            const newCourtA = [...bestCourts[cA]];
            newCourtA[pAIdx] = playerB;
            const newCourtB = [...bestCourts[cB]];
            newCourtB[pBIdx] = playerA;

            const optA = optimizeCourtPairing(
              newCourtA as [Player, Player, Player, Player],
              currentMatchIndex,
              partnerHistory,
              opponentHistory
            );
            const optB = optimizeCourtPairing(
              newCourtB as [Player, Player, Player, Player],
              currentMatchIndex,
              partnerHistory,
              opponentHistory
            );

            const oldScore = bestCourtOpt[cA].penalty + bestCourtOpt[cB].penalty;
            const newScore = optA.penalty + optB.penalty;

            if (newScore < oldScore - 1) {
              bestCourts[cA] = newCourtA;
              bestCourts[cB] = newCourtB;
              bestCourtOpt[cA] = optA;
              bestCourtOpt[cB] = optB;
              bestTotalPenalty = bestTotalPenalty - oldScore + newScore;
              improved = true;
            }
          }
        }
      }
    }
  }

  return bestCourtOpt.map((opt) => ({
    teamA: opt.teamA,
    teamB: opt.teamB,
  }));
}

/**
 * ENGINE SIMULASI UTAMA
 * 
 * Mendukung 1 hingga 5 lapangan secara dinamis.
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
  overrides: Record<number, MatchOverride>,
  courtCount: number = 2,
  completedMatches: Record<number, CompletedMatchInfo> = {}
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
    const isCompleted = Boolean(completedMatches[m]);
    const completedData = completedMatches[m];
    const isOverridden = Boolean(overrides[m]);
    const playingIds = new Set<string>();
    const courtMatches: (CourtMatch | null)[] = [];

    const waitCountsSnapshot: Record<string, number> = {};
    const matchesPlayedSnapshot: Record<string, number> = {};
    for (const p of activePlayers) {
      waitCountsSnapshot[p.id] = currentWaitCount.get(p.id) || 0;
      matchesPlayedSnapshot[p.id] = currentMatchesPlayed.get(p.id) || 0;
    }

    // KASUS 0: MATCH SUDAH DITANDAI SELESAI (TERKUNCI)
    // Formasi dibekukan dan penambahan pemain baru tidak mengubah match ini.
    // Statistik diteruskan untuk melanjutkan match-match berikutnya.
    if (isCompleted && completedData) {
      const lockedCourts = completedData.courts || [];
      const lockedPlaying = new Set<string>(completedData.playingPlayerIds || []);
      const lockedWaiting = new Set<string>(completedData.waitingPlayerIds || []);

      lockedCourts.forEach((cm) => courtMatches.push(cm));
      lockedPlaying.forEach((id) => playingIds.add(id));

      const playerCourts: Record<string, string | null> = {};

      courtMatches.forEach((courtMatch) => {
        if (courtMatch) {
          const cCode = `c${courtMatch.courtNumber}`;
          playerCourts[courtMatch.teamA.player1Id] = cCode;
          playerCourts[courtMatch.teamA.player2Id] = cCode;
          playerCourts[courtMatch.teamB.player1Id] = cCode;
          playerCourts[courtMatch.teamB.player2Id] = cCode;

          helperRecordPartnership(courtMatch.teamA.player1Id, courtMatch.teamA.player2Id, m);
          helperRecordPartnership(courtMatch.teamB.player1Id, courtMatch.teamB.player2Id, m);
          helperRecordOpponents(
            [courtMatch.teamA.player1Id, courtMatch.teamA.player2Id],
            [courtMatch.teamB.player1Id, courtMatch.teamB.player2Id],
            m
          );
        }
      });

      // Update statistik pemain yang bermain pada match selesai ini
      for (const pId of playingIds) {
        currentWaitCount.set(pId, 0);
        currentMatchesPlayed.set(pId, (currentMatchesPlayed.get(pId) || 0) + 1);
      }

      // Update pemain yang menunggu pada match selesai ini
      // PENTING: Pemain baru yang baru hadir/bergabung setelah match ini selesai
      // tidak ada di lockedWaiting, sehingga waitCount-nya TETAP 0 (tidak dihitung menunggu fiktif).
      const waitingList: string[] = [];
      for (const player of activePlayers) {
        if (playingIds.has(player.id)) continue;

        playerCourts[player.id] = null;

        if (lockedWaiting.has(player.id)) {
          waitingList.push(player.id);
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
        courts: courtMatches,
        court1: courtMatches[0] || null,
        court2: courtMatches[1] || null,
        court3: courtMatches[2] || null,
        court4: courtMatches[3] || null,
        court5: courtMatches[4] || null,
        playingPlayerIds: playingIds,
        waitingPlayerIds: waitingList,
        isOverridden,
        isCompleted: true,
        playerCourts,
        waitCountsSnapshot,
        matchesPlayedSnapshot,
      });
      continue;
    }

    // Helper pembaca override per nomor lapangan
    const getOverrideForCourt = (c: number) => {
      const ov = overrides[m];
      if (!ov) return null;
      if (ov.courts && ov.courts[c] !== undefined) return ov.courts[c];
      if (c === 1 && ov.court1) return ov.court1;
      if (c === 2 && ov.court2) return ov.court2;
      if (c === 3 && ov.court3) return ov.court3;
      if (c === 4 && ov.court4) return ov.court4;
      if (c === 5 && ov.court5) return ov.court5;
      return null;
    };

    let hasAnyOverride = false;
    for (let c = 1; c <= courtCount; c++) {
      if (getOverrideForCourt(c)) {
        hasAnyOverride = true;
        break;
      }
    }

    // KASUS A: MATCH INI DIOVERRIDE SECARA MANUAL OLEH USER
    if (isOverridden && hasAnyOverride) {
      for (let c = 1; c <= courtCount; c++) {
        const cOv = getOverrideForCourt(c);
        if (cOv) {
          const [a1, a2] = cOv.teamA;
          const [b1, b2] = cOv.teamB;
          const pA1 = playerMap.get(a1);
          const pA2 = playerMap.get(a2);
          const pB1 = playerMap.get(b1);
          const pB2 = playerMap.get(b2);

          if (pA1 && pA2 && pB1 && pB2) {
            const teamALvl = pA1.level + pA2.level;
            const teamBLvl = pB1.level + pB2.level;
            courtMatches.push({
              courtNumber: c,
              teamA: { player1Id: a1, player2Id: a2 },
              teamB: { player1Id: b1, player2Id: b2 },
              teamALevel: teamALvl,
              teamBLevel: teamBLvl,
              levelDiff: Math.abs(teamALvl - teamBLvl),
            });
            playingIds.add(a1);
            playingIds.add(a2);
            playingIds.add(b1);
            playingIds.add(b2);
            continue;
          }
        }
        courtMatches.push(null);
      }
    } else {
      // KASUS B: GENERATE OTOMATIS
      // Pemain reguler yang eligible (Admin TIDAK ikut draft otomatis)
      const autoEligiblePlayers = activePlayers.filter((p) => !p.isAdmin);
      const eligibleCount = autoEligiblePlayers.length;
      const maxCourtsPossible = Math.floor(eligibleCount / 4);
      const courtsToRun = Math.min(courtCount, maxCourtsPossible);

      if (courtsToRun === 0) {
        results.push({
          matchIndex: m,
          courts: Array(courtCount).fill(null),
          court1: null,
          court2: null,
          playingPlayerIds: new Set(),
          waitingPlayerIds: activePlayers.map((p) => p.id),
          isOverridden: false,
          isCompleted: false,
          playerCourts: {},
          waitCountsSnapshot,
          matchesPlayedSnapshot,
        });
        continue;
      }

      const slotsNeeded = courtsToRun * 4;

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

      if (courtsToRun === 1) {
        const opt = optimizeCourtPairing(
          selectedPlayers as [Player, Player, Player, Player],
          m,
          partnerHistory,
          opponentHistory
        );

        const teamALvl = opt.teamA[0].level + opt.teamA[1].level;
        const teamBLvl = opt.teamB[0].level + opt.teamB[1].level;

        courtMatches.push({
          courtNumber: 1,
          teamA: { player1Id: opt.teamA[0].id, player2Id: opt.teamA[1].id },
          teamB: { player1Id: opt.teamB[0].id, player2Id: opt.teamB[1].id },
          teamALevel: teamALvl,
          teamBLevel: teamBLvl,
          levelDiff: Math.abs(teamALvl - teamBLvl),
        });
        for (let c = 2; c <= courtCount; c++) {
          courtMatches.push(null);
        }
      } else if (courtsToRun === 2) {
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

        courtMatches.push({
          courtNumber: 1,
          teamA: { player1Id: opt.court1.teamA[0].id, player2Id: opt.court1.teamA[1].id },
          teamB: { player1Id: opt.court1.teamB[0].id, player2Id: opt.court1.teamB[1].id },
          teamALevel: c1ALvl,
          teamBLevel: c1BLvl,
          levelDiff: Math.abs(c1ALvl - c1BLvl),
        });

        courtMatches.push({
          courtNumber: 2,
          teamA: { player1Id: opt.court2.teamA[0].id, player2Id: opt.court2.teamA[1].id },
          teamB: { player1Id: opt.court2.teamB[0].id, player2Id: opt.court2.teamB[1].id },
          teamALevel: c2ALvl,
          teamBLevel: c2BLvl,
          levelDiff: Math.abs(c2ALvl - c2BLvl),
        });
        for (let c = 3; c <= courtCount; c++) {
          courtMatches.push(null);
        }
      } else {
        // courtsToRun >= 3 (3, 4, atau 5 lapangan)
        const multiOpts = optimizeMultiCourtPairings(
          selectedPlayers,
          courtsToRun,
          m,
          partnerHistory,
          opponentHistory
        );

        for (let i = 0; i < courtsToRun; i++) {
          const opt = multiOpts[i];
          const tALvl = opt.teamA[0].level + opt.teamA[1].level;
          const tBLvl = opt.teamB[0].level + opt.teamB[1].level;

          courtMatches.push({
            courtNumber: i + 1,
            teamA: { player1Id: opt.teamA[0].id, player2Id: opt.teamA[1].id },
            teamB: { player1Id: opt.teamB[0].id, player2Id: opt.teamB[1].id },
            teamALevel: tALvl,
            teamBLevel: tBLvl,
            levelDiff: Math.abs(tALvl - tBLvl),
          });
        }
        for (let c = courtsToRun + 1; c <= courtCount; c++) {
          courtMatches.push(null);
        }
      }
    }

    const playerCourts: Record<string, string | null> = {};

    courtMatches.forEach((courtMatch) => {
      if (courtMatch) {
        const cCode = `c${courtMatch.courtNumber}`;
        playerCourts[courtMatch.teamA.player1Id] = cCode;
        playerCourts[courtMatch.teamA.player2Id] = cCode;
        playerCourts[courtMatch.teamB.player1Id] = cCode;
        playerCourts[courtMatch.teamB.player2Id] = cCode;

        helperRecordPartnership(courtMatch.teamA.player1Id, courtMatch.teamA.player2Id, m);
        helperRecordPartnership(courtMatch.teamB.player1Id, courtMatch.teamB.player2Id, m);
        helperRecordOpponents(
          [courtMatch.teamA.player1Id, courtMatch.teamA.player2Id],
          [courtMatch.teamB.player1Id, courtMatch.teamB.player2Id],
          m
        );
      }
    });

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
      courts: courtMatches,
      court1: courtMatches[0] || null,
      court2: courtMatches[1] || null,
      court3: courtMatches[2] || null,
      court4: courtMatches[3] || null,
      court5: courtMatches[4] || null,
      playingPlayerIds: playingIds,
      waitingPlayerIds,
      isOverridden,
      isCompleted: false,
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
  courtCount: number;
  onSaveOverride: (matchIdx: number, override: MatchOverride) => void;
  onResetOverride: (matchIdx: number) => void;
  courtShuttlecocks: CourtShuttlecockData;
  onUpdateCourtShuttlecock: (
    matchIdx: number,
    courtKey: string,
    count: number
  ) => void;
  isCompleted: boolean;
  onToggleCompleted: (matchIdx: number, isCompleted: boolean) => void;
}

const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  isOpen,
  onClose,
  matchIndex,
  projection,
  activePlayers,
  allPlayers,
  courtCount,
  onSaveOverride,
  onResetOverride,
  courtShuttlecocks,
  onUpdateCourtShuttlecock,
  isCompleted,
  onToggleCompleted,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playerMap = useMemo(() => {
    return new Map(allPlayers.map((p) => [p.id, p]));
  }, [allPlayers]);

  // Edit state dinamis per lapangan: { [cNum]: { a1, a2, b1, b2 } }
  const [editCourts, setEditCourts] = useState<
    Record<number, { a1: string; a2: string; b1: string; b2: string }>
  >({});

  React.useEffect(() => {
    if (!projection) return;
    setIsEditMode(projection.isOverridden);
    setErrorMsg(null);

    const initialEdit: Record<
      number,
      { a1: string; a2: string; b1: string; b2: string }
    > = {};

    for (let c = 1; c <= courtCount; c++) {
      const courtMatch =
        projection.courts?.[c - 1] ||
        (c === 1 ? projection.court1 : c === 2 ? projection.court2 : null);

      if (courtMatch) {
        initialEdit[c] = {
          a1: courtMatch.teamA.player1Id,
          a2: courtMatch.teamA.player2Id,
          b1: courtMatch.teamB.player1Id,
          b2: courtMatch.teamB.player2Id,
        };
      } else {
        initialEdit[c] = { a1: "", a2: "", b1: "", b2: "" };
      }
    }

    setEditCourts(initialEdit);
  }, [projection, isOpen, courtCount]);

  const handleCourtPlayerChange = (
    courtNum: number,
    slot: "a1" | "a2" | "b1" | "b2",
    playerId: string
  ) => {
    setEditCourts((prev) => ({
      ...prev,
      [courtNum]: {
        ...(prev[courtNum] || { a1: "", a2: "", b1: "", b2: "" }),
        [slot]: playerId,
      },
    }));
  };

  const getPlayerStatusInMatch = useCallback(
    (player: Player) => {
      let isPlayingInThisMatch = false;
      for (let c = 1; c <= courtCount; c++) {
        const ec = editCourts[c];
        if (ec && [ec.a1, ec.a2, ec.b1, ec.b2].includes(player.id)) {
          isPlayingInThisMatch = true;
          break;
        }
      }

      if (isPlayingInThisMatch) {
        return "(sedang bermain)";
      }

      if (player.isAdmin) {
        return "(standby / manual only)";
      }

      const wait = projection?.waitCountsSnapshot?.[player.id] ?? 0;
      return `(tunggu ${wait}x)`;
    },
    [editCourts, courtCount, projection]
  );

  if (!isOpen || !projection) return null;

  const handleSave = () => {
    setErrorMsg(null);

    const overrideObj: MatchOverride = {
      courts: {},
    };

    const allSelectedPlayerIds: string[] = [];
    let filledCourtsCount = 0;

    for (let c = 1; c <= courtCount; c++) {
      const ec = editCourts[c];
      const hasAny = Boolean(ec?.a1 || ec?.a2 || ec?.b1 || ec?.b2);
      const isComplete = Boolean(ec?.a1 && ec?.a2 && ec?.b1 && ec?.b2);

      if (hasAny && !isComplete) {
        setErrorMsg(`Formasi Lapangan ${c} belum lengkap (harus 4 pemain)!`);
        return;
      }

      if (isComplete) {
        filledCourtsCount++;
        allSelectedPlayerIds.push(ec.a1, ec.a2, ec.b1, ec.b2);
        overrideObj.courts![c] = {
          teamA: [ec.a1, ec.a2],
          teamB: [ec.b1, ec.b2],
        };
        if (c === 1) overrideObj.court1 = overrideObj.courts![c];
        if (c === 2) overrideObj.court2 = overrideObj.courts![c];
        if (c === 3) overrideObj.court3 = overrideObj.courts![c];
        if (c === 4) overrideObj.court4 = overrideObj.courts![c];
        if (c === 5) overrideObj.court5 = overrideObj.courts![c];
      } else {
        overrideObj.courts![c] = null;
        if (c === 1) overrideObj.court1 = null;
        if (c === 2) overrideObj.court2 = null;
        if (c === 3) overrideObj.court3 = null;
        if (c === 4) overrideObj.court4 = null;
        if (c === 5) overrideObj.court5 = null;
      }
    }

    if (filledCourtsCount === 0) {
      setErrorMsg("Harap pilih formasi pemain minimal untuk 1 lapangan!");
      return;
    }

    const uniqueIds = new Set(allSelectedPlayerIds);
    if (uniqueIds.size !== allSelectedPlayerIds.length) {
      setErrorMsg("Ada pemain yang dipilih lebih dari 1 kali dalam match yang sama!");
      return;
    }

    onSaveOverride(matchIndex, overrideObj);
    onClose();
  };

  const handleReset = () => {
    onResetOverride(matchIndex);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-emerald-950/20 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-lg">
              M{matchIndex}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Detail Pertandingan Match {matchIndex}
                {isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                    <span>✓</span> Selesai (Terkunci)
                  </span>
                )}
                {projection.isOverridden && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                    Edited / Override
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Susunan pemain &amp; input shuttlecock per lapangan (1 s/d {courtCount} lapangan).
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
          <div className="flex flex-wrap items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <label
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition select-none ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : "bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                }`}
                title="Tandai match ini selesai untuk membekukan formasi dari perubahan"
              >
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={(e) => onToggleCompleted(matchIndex, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <span>{isCompleted ? "Match Selesai (Terkunci) ✓" : "Tandai Match Selesai"}</span>
              </label>

              <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                Formasi:{" "}
                <strong className={projection.isOverridden ? "text-amber-400" : "text-emerald-400"}>
                  {projection.isOverridden ? "Manual Override" : "Otomatis"}
                </strong>
              </span>
            </div>

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

          {/* Daftar Lapangan (1 sampai courtCount) */}
          <div className="space-y-4">
            {Array.from({ length: courtCount }, (_, i) => i + 1).map((cNum) => {
              const theme = COURT_THEMES[cNum] || COURT_THEMES[1];
              const courtMatch =
                projection.courts?.[cNum - 1] ||
                (cNum === 1 ? projection.court1 : cNum === 2 ? projection.court2 : null);
              const cCock = courtShuttlecocks[`court${cNum}`] || 0;
              const ec = editCourts[cNum] || { a1: "", a2: "", b1: "", b2: "" };

              return (
                <div
                  key={cNum}
                  className={`bg-slate-950/70 border rounded-xl p-4 relative overflow-hidden ${theme.borderClass}`}
                >
                  <div
                    className={`absolute top-0 right-0 px-3 py-1 text-xs font-black rounded-bl-xl border-b border-l uppercase ${theme.bgHeaderClass} ${theme.borderClass}`}
                  >
                    COURT {cNum}
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-sm font-bold flex items-center gap-2 ${theme.textClass}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${theme.accentBg} animate-pulse`}></span>
                      {theme.name} (Ganda)
                    </h4>
                  </div>

                  {isEditMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-slate-300">
                          Tim A ({theme.name})
                        </div>
                        <select
                          value={ec.a1}
                          onChange={(e) =>
                            handleCourtPlayerChange(cNum, "a1", e.target.value)
                          }
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
                          value={ec.a2}
                          onChange={(e) =>
                            handleCourtPlayerChange(cNum, "a2", e.target.value)
                          }
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
                        <div className="text-xs font-bold text-slate-300">
                          Tim B ({theme.name})
                        </div>
                        <select
                          value={ec.b1}
                          onChange={(e) =>
                            handleCourtPlayerChange(cNum, "b1", e.target.value)
                          }
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
                          value={ec.b2}
                          onChange={(e) =>
                            handleCourtPlayerChange(cNum, "b2", e.target.value)
                          }
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
                  ) : courtMatch ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-900/90 rounded-xl border border-slate-800/80">
                      <div className="flex-1 text-center sm:text-left">
                        <div className="text-xs text-slate-400 font-semibold mb-1">
                          TIM A (Level: {courtMatch.teamALevel})
                        </div>
                        <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                          {playerMap.get(courtMatch.teamA.player1Id)?.isAdmin && <span>👑</span>}
                          <span>{playerMap.get(courtMatch.teamA.player1Id)?.name}</span>
                          <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                            [L{playerMap.get(courtMatch.teamA.player1Id)?.level}]
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                          {playerMap.get(courtMatch.teamA.player2Id)?.isAdmin && <span>👑</span>}
                          <span>{playerMap.get(courtMatch.teamA.player2Id)?.name}</span>
                          <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                            [L{playerMap.get(courtMatch.teamA.player2Id)?.level}]
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`px-3 py-1 rounded-full border text-xs font-black ${theme.bgHeaderClass} ${theme.borderClass}`}
                        >
                          VS
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            courtMatch.levelDiff <= 2
                              ? `${theme.bgHeaderClass} ${theme.borderClass}`
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          Δ {courtMatch.levelDiff} Lvl {courtMatch.levelDiff <= 2 ? "✓" : "⚠️"}
                        </span>
                      </div>

                      <div className="flex-1 text-center sm:text-right">
                        <div className="text-xs text-slate-400 font-semibold mb-1">
                          TIM B (Level: {courtMatch.teamBLevel})
                        </div>
                        <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                          {playerMap.get(courtMatch.teamB.player1Id)?.isAdmin && <span>👑</span>}
                          <span>{playerMap.get(courtMatch.teamB.player1Id)?.name}</span>
                          <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                            [L{playerMap.get(courtMatch.teamB.player1Id)?.level}]
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                          {playerMap.get(courtMatch.teamB.player2Id)?.isAdmin && <span>👑</span>}
                          <span>{playerMap.get(courtMatch.teamB.player2Id)?.name}</span>
                          <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                            [L{playerMap.get(courtMatch.teamB.player2Id)?.level}]
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 italic">
                      {activePlayers.filter((p) => !p.isAdmin).length < cNum * 4
                        ? `Pemain aktif belum mencapai ${cNum * 4} orang (${theme.name} tidak berjalan).`
                        : `${theme.name} kosong.`}
                    </div>
                  )}

                  {/* Input Shuttlecock Khusus Lapangan Ini */}
                  <div
                    className={`mt-3 pt-3 border-t flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg ${theme.borderClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🏸</span>
                      <div>
                        <div
                          className={`text-xs font-bold flex items-center gap-1.5 ${theme.textClass}`}
                        >
                          <span>Shuttlecock {theme.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${theme.bgHeaderClass}`}
                          >
                            Rp {(cCock * 3000).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Dikenakan kepada pemain reguler yang bertanding di {theme.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCourtShuttlecock(
                            matchIndex,
                            `court${cNum}`,
                            Math.max(0, cCock - 1)
                          )
                        }
                        className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition border border-slate-700"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={cCock}
                        onChange={(e) =>
                          onUpdateCourtShuttlecock(
                            matchIndex,
                            `court${cNum}`,
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className={`w-12 bg-slate-950 border border-slate-700 rounded text-center text-xs font-black py-1 focus:outline-none ${theme.textClass}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCourtShuttlecock(
                            matchIndex,
                            `court${cNum}`,
                            cCock + 1
                          )
                        }
                        className={`w-7 h-7 rounded font-bold flex items-center justify-center text-xs transition ${theme.accentBg} ${theme.accentHover} ${theme.accentText}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
  const [courtCount, setCourtCount] = useState<number>(2);
  const [overrides, setOverrides] = useState<Record<number, MatchOverride>>({});
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number | null>(null);

  // State Match Selesai (Terkunci)
  const [completedMatches, setCompletedMatches] = useState<
    Record<number, CompletedMatchInfo>
  >({});

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

  // State Tab Navigasi Menu: "pertandingan" | "spreadsheet"
  const [activeTab, setActiveTab] = useState<"pertandingan" | "spreadsheet">("pertandingan");

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
      setCompletedMatches({});
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
    (matchIdx: number, courtKey: string, count: number) => {
      setMatchCourtShuttlecocks((prev) => {
        const current = prev[matchIdx] || {};
        return {
          ...prev,
          [matchIdx]: {
            ...current,
            [courtKey]: Math.max(0, count),
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

  const playerMap = useMemo(() => {
    return new Map<string, Player>(players.map((p) => [p.id, p]));
  }, [players]);

  const projections = useMemo(() => {
    return generateMatchProjections(
      players,
      projectedMatchCount,
      overrides,
      courtCount,
      completedMatches
    );
  }, [players, projectedMatchCount, overrides, courtCount, completedMatches]);

  const handleToggleMatchCompleted = useCallback(
    (matchIdx: number, isCompleted: boolean) => {
      if (isCompleted) {
        // Ambil snapshot formasi match yang sedang aktif untuk dibekukan
        const proj = projections.find((p) => p.matchIndex === matchIdx);
        if (proj) {
          setCompletedMatches((prev) => ({
            ...prev,
            [matchIdx]: {
              matchIndex: matchIdx,
              courts: proj.courts,
              playingPlayerIds: Array.from(proj.playingPlayerIds),
              waitingPlayerIds: [...proj.waitingPlayerIds],
              completedAt: new Date().toISOString(),
            },
          }));
        }
      } else {
        setCompletedMatches((prev) => {
          const next = { ...prev };
          delete next[matchIdx];
          return next;
        });
      }
    },
    [projections]
  );

  const totalSessionShuttlecocks = useMemo(() => {
    return Object.values(matchCourtShuttlecocks).reduce(
      (sum, val) =>
        sum +
        Object.values(val).reduce((courtSum, count) => courtSum + (count || 0), 0),
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
        courtBreakdown: Record<string, number>;
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
          courtBreakdown: {},
        });
        continue;
      }

      let countPlayed = 0;
      let totalPlayerShuttlecocks = 0;
      let c1Count = 0;
      let c2Count = 0;
      const courtBreakdown: Record<string, number> = {};
      for (let c = 1; c <= courtCount; c++) {
        courtBreakdown[`c${c}`] = 0;
      }

      for (const proj of projections) {
        const courtCode = proj.playerCourts[player.id];
        if (courtCode) {
          countPlayed += 1;
          const cNum = parseInt(courtCode.replace("c", "")) || 1;
          if (cNum === 1) c1Count += 1;
          if (cNum === 2) c2Count += 1;
          courtBreakdown[courtCode] = (courtBreakdown[courtCode] || 0) + 1;
          const cCock = matchCourtShuttlecocks[proj.matchIndex]?.[`court${cNum}`] ?? 0;
          totalPlayerShuttlecocks += cCock;
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
        courtBreakdown,
      });
    }

    return map;
  }, [players, projections, matchCourtShuttlecocks, customFees, courtCount]);

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
    const maxPossible = Math.floor(regularPresent / 4);
    const activeCourts = Math.min(courtCount, maxPossible);

    let courtStatus = "Belum Cukup Pemain";

    if (regularPresent >= courtCount * 4) {
      courtStatus = `${courtCount} Lapangan (${courtCount * 4} Main, ${regularPresent - courtCount * 4} Menunggu)`;
    } else if (activeCourts > 0) {
      courtStatus = `${activeCourts}/${courtCount} Lapangan (${activeCourts * 4} Main, ${regularPresent - activeCourts * 4} Menunggu)`;
    } else {
      courtStatus = "Kurang " + (4 - regularPresent) + " Orang Lagi";
    }

    const overrideCount = Object.keys(overrides).length;
    const customFeeCount = Object.keys(customFees).length;
    const completedCount = Object.keys(completedMatches).length;

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
      completedCount,
      regularPresent,
      qrisPaidCount,
      cashPaidCount,
      totalPaidCount,
    };
  }, [presentPlayers, overrides, customFees, paymentStatuses, courtCount, completedMatches]);

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

          {/* Menu Navigasi Utama */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("pertandingan")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "pertandingan"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🏸 Pertandingan</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === "pertandingan"
                    ? "bg-slate-950/20 text-slate-950 font-mono font-bold"
                    : "bg-slate-800 text-slate-400 font-mono"
                }`}
              >
                M1-M{projectedMatchCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("spreadsheet")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "spreadsheet"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📊 Rotasi Pemain</span>
            </button>
          </div>

          {/* Quick Actions & Setting Proyeksi & Lapangan */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Setting Proyeksi Match */}
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

            {/* Setting Jumlah Lapangan (1 s/d 5 Lapangan) */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 gap-1.5 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">Lapangan:</span>
              <button
                type="button"
                onClick={() => setCourtCount((prev) => Math.max(1, prev - 1))}
                disabled={courtCount <= 1}
                className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-white font-bold flex items-center justify-center text-xs transition"
                title="Kurangi jumlah lapangan (minimal 1)"
              >
                -
              </button>
              <span className="w-5 text-center text-xs font-black text-emerald-400 font-mono">
                {courtCount}
              </span>
              <button
                type="button"
                onClick={() => setCourtCount((prev) => Math.min(5, prev + 1))}
                disabled={courtCount >= 5}
                className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-white font-bold flex items-center justify-center text-xs transition"
                title="Tambah jumlah lapangan (maksimal 5)"
              >
                +
              </button>
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

            {stats.completedCount > 0 && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Buka kunci semua (${stats.completedCount}) match yang sudah selesai? Formasi akan kembali dihitung dinamis.`
                    )
                  ) {
                    setCompletedMatches({});
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1.5"
                title="Buka kunci semua match selesai dan kembalikan ke rotasi dinamis"
              >
                <span>Reset {stats.completedCount} Selesai</span>
              </button>
            )}

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
              title="Reset ke daftar data contoh abjad (A, B, C, D...)"
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

          {/* KPI 2: Status Lapangan & Progres Match */}
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
                Status Lapangan &amp; Progres
              </div>
              <div className="text-sm font-bold text-white truncate max-w-[180px]">
                {stats.courtStatus}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <span>🏁 {stats.completedCount} dari {projectedMatchCount} Selesai</span>
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
                                ({Array.from({ length: courtCount }, (_, i) => `c${i + 1}: ${pStats?.courtBreakdown?.[`c${i + 1}`] || 0}`).join(", ")})
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
            MENU TAB SWITCHER (DESKTOP & MOBILE)
        ==================================================================== */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
          <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("pertandingan")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "pertandingan"
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <span>🏸 Pertandingan</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === "pertandingan"
                    ? "bg-slate-950/25 text-slate-950"
                    : "bg-slate-800 text-emerald-400 border border-slate-700"
                }`}
              >
                M1 - M{projectedMatchCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("spreadsheet")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "spreadsheet"
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <span>📊 Rotasi Pemain (Spreadsheet)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 px-3.5 py-2 rounded-xl">
            <span>🏁 Selesai: <strong className="text-emerald-400 font-mono font-bold">{stats.completedCount}</strong>/{projectedMatchCount} Match</span>
            <span>·</span>
            <span>🏸 Total Cock: <strong className="text-emerald-400 font-mono font-bold">{totalSessionShuttlecocks}</strong></span>
          </div>
        </div>

        {/* ===================================================================
            KONTEN TAMPILAN: TABEL PERTANDINGAN ATAU SPREADSHEET
        ==================================================================== */}
        {activeTab === "pertandingan" ? (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
            {/* Header Tabel Pertandingan */}
            <div className="p-4 sm:px-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🏸 Tabel Pertandingan (M1 s/d M{projectedMatchCount})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daftar pertandingan ringkas: nama siapa vs siapa, lapangan, jumlah kok yang dipakai, dan status selesai.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>{stats.completedCount} Selesai</span>
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-medium">
                  {projectedMatchCount - stats.completedCount} Belum Selesai
                </span>
              </div>
            </div>

            {/* Tabel Pertandingan */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-xs font-semibold">
                    <th className="py-3 px-4 w-24 text-center">Match</th>
                    <th className="py-3 px-4 w-40">Lapangan</th>
                    <th className="py-3 px-4 min-w-[320px]">Pertandingan (Siapa vs Siapa)</th>
                    <th className="py-3 px-4 w-48 text-center">Jumlah Kok</th>
                    <th className="py-3 px-4 w-48 text-center">Status Pertandingan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {presentPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic text-sm">
                        Belum ada pemain yang berstatus hadir. Buka panel &quot;Kelola Pemain&quot; untuk mencentang kehadiran.
                      </td>
                    </tr>
                  ) : (
                    projections.flatMap((proj) => {
                      const isCompleted = Boolean(completedMatches[proj.matchIndex]);
                      const activeCourtsList = Array.from({ length: courtCount }, (_, i) => i + 1);

                      return activeCourtsList.map((cNum) => {
                        const theme = COURT_THEMES[cNum] || COURT_THEMES[1];
                        const courtMatch =
                          proj.courts?.[cNum - 1] ||
                          (cNum === 1 ? proj.court1 : cNum === 2 ? proj.court2 : null);
                        const cockCount =
                          matchCourtShuttlecocks[proj.matchIndex]?.[`court${cNum}`] ?? 0;

                        const pA1 = courtMatch?.teamA?.player1Id ? playerMap.get(courtMatch.teamA.player1Id) : null;
                        const pA2 = courtMatch?.teamA?.player2Id ? playerMap.get(courtMatch.teamA.player2Id) : null;
                        const pB1 = courtMatch?.teamB?.player1Id ? playerMap.get(courtMatch.teamB.player1Id) : null;
                        const pB2 = courtMatch?.teamB?.player2Id ? playerMap.get(courtMatch.teamB.player2Id) : null;

                        const hasMatch = Boolean(pA1 && pA2 && pB1 && pB2);

                        return (
                          <tr
                            key={`m${proj.matchIndex}-c${cNum}`}
                            className={`transition-colors ${
                              isCompleted
                                ? "bg-emerald-950/20 hover:bg-emerald-950/30 border-l-4 border-l-emerald-500"
                                : "hover:bg-slate-800/40 border-l-4 border-l-transparent"
                            }`}
                          >
                            {/* Kolom Match */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                                className={`inline-flex items-center justify-center font-mono font-black text-xs px-2.5 py-1 rounded-lg border transition ${
                                  isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                                    : "bg-slate-950 text-emerald-400 border-slate-800 hover:border-slate-700"
                                }`}
                                title="Klik untuk melihat detail atau edit formasi match ini"
                              >
                                M{proj.matchIndex}
                                {proj.isOverridden && (
                                  <span className="ml-1 text-[10px] text-amber-400" title="Override aktif">
                                    ✏️
                                  </span>
                                )}
                              </button>
                            </td>

                            {/* Kolom Lapangan */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${theme.badgeClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`}></span>
                                {theme.name}
                              </span>
                            </td>

                            {/* Kolom Pertandingan (Siapa vs Siapa) */}
                            <td className="py-3.5 px-4">
                              {hasMatch ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                                    <span className="text-emerald-400">
                                      {pA1?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                      {pA1?.name}
                                    </span>
                                    <span className="text-slate-500 font-normal text-xs">&amp;</span>
                                    <span className="text-emerald-400">
                                      {pA2?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                      {pA2?.name}
                                    </span>
                                  </div>

                                  <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    VS
                                  </span>

                                  <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                                    <span className="text-sky-400">
                                      {pB1?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                      {pB1?.name}
                                    </span>
                                    <span className="text-slate-500 font-normal text-xs">&amp;</span>
                                    <span className="text-sky-400">
                                      {pB2?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                      {pB2?.name}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 italic">
                                  - Lapangan Kosong (Kurang Pemain) -
                                </span>
                              )}
                            </td>

                            {/* Kolom Jumlah Kok */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCourtShuttlecock(
                                      proj.matchIndex,
                                      `court${cNum}`,
                                      Math.max(0, cockCount - 1)
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold transition active:scale-95 disabled:opacity-40"
                                  title="Kurangi 1 kok"
                                  disabled={cockCount <= 0}
                                >
                                  -
                                </button>
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 min-w-[58px] justify-center">
                                  <input
                                    type="number"
                                    min={0}
                                    value={cockCount}
                                    onChange={(e) =>
                                      handleUpdateCourtShuttlecock(
                                        proj.matchIndex,
                                        `court${cNum}`,
                                        Math.max(0, parseInt(e.target.value) || 0)
                                      )
                                    }
                                    className="w-7 bg-transparent text-center font-mono font-black text-white text-xs focus:outline-none"
                                    title="Klik untuk ubah angka kok langsung"
                                  />
                                  <span className="text-xs" title="Shuttlecock">🏸</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCourtShuttlecock(
                                      proj.matchIndex,
                                      `court${cNum}`,
                                      cockCount + 1
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold transition active:scale-95"
                                  title="Tambah 1 kok"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Kolom Status Pertandingan */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleMatchCompleted(proj.matchIndex, !isCompleted)
                                }
                                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shadow-sm select-none cursor-pointer ${
                                  isCompleted
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30 shadow-emerald-950/50"
                                    : "bg-slate-800/90 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                                }`}
                                title={
                                  isCompleted
                                    ? `Match ${proj.matchIndex} sudah Selesai. Klik untuk batalkan.`
                                    : `Klik untuk menandai Match ${proj.matchIndex} Selesai`
                                }
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isCompleted ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                                  }`}
                                ></span>
                                <span>{isCompleted ? "✓ Selesai" : "⏳ Belum Selesai"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Tabel Pertandingan */}
            <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Hijau: Pertandingan telah selesai</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                  <span>Abu-abu: Pertandingan belum selesai</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                💡 Klik tombol status pada match mana saja untuk mengubah status Selesai / Belum Selesai secara instan.
              </div>
            </div>
          </section>
        ) : (
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
                    const isCompleted = Boolean(completedMatches[proj.matchIndex]);
                    return (
                      <th
                        key={proj.matchIndex}
                        onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                        className={`py-2 px-2 text-center border-r border-slate-800/80 min-w-[105px] cursor-pointer hover:bg-slate-800/80 transition-colors group select-none ${
                          isCompleted
                            ? "bg-emerald-950/25 border-emerald-500/40"
                            : ""
                        }`}
                        title="Klik untuk melihat detail atau edit formasi match ini"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-xs font-black font-mono flex items-center gap-1 ${
                                isCompleted
                                  ? "text-emerald-300"
                                  : "text-emerald-400 group-hover:text-emerald-300"
                              }`}
                            >
                              M{proj.matchIndex}
                              {proj.isOverridden && (
                                <span className="text-[10px] text-amber-400" title="Override aktif">
                                  ✏️
                                </span>
                              )}
                            </span>
                            {isCompleted && (
                              <span
                                className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                                title="Match selesai (formasi terkunci)"
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                            {isCompleted
                              ? "Selesai"
                              : proj.isOverridden
                              ? "Manual"
                              : "Auto"}
                          </span>

                          {/* Input Shuttlecock per Lapangan (c1 .. c5) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 flex flex-col items-center gap-1 w-full"
                          >
                            {Array.from({ length: courtCount }, (_, i) => i + 1).map((cNum) => {
                              const courtMatch = proj.courts?.[cNum - 1] || null;
                              const cVal = matchCourtShuttlecocks[proj.matchIndex]?.[`court${cNum}`] ?? 0;
                              // Tampilkan input jika lapangan terisi di match ini atau sudah ada input cock
                              const regularActive = presentPlayers.filter((p) => !p.isAdmin).length;
                              if (!courtMatch && cVal === 0 && regularActive < cNum * 4) {
                                return null;
                              }
                              const theme = COURT_THEMES[cNum] || COURT_THEMES[1];
                              return (
                                <div
                                  key={cNum}
                                  className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 w-full transition border ${theme.bgSubtleClass}`}
                                  title={`Shuttlecock ${theme.name} di Match ${proj.matchIndex}`}
                                >
                                  <span className={`text-[9px] font-black font-mono ${theme.textClass}`}>
                                    {theme.code}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={cVal}
                                    onChange={(e) =>
                                      handleUpdateCourtShuttlecock(
                                        proj.matchIndex,
                                        `court${cNum}`,
                                        Math.max(0, parseInt(e.target.value) || 0)
                                      )
                                    }
                                    className={`w-6 bg-transparent text-right text-[10px] font-black focus:outline-none cursor-text ${theme.textClass}`}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Checkbox Tandai Match Selesai */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 w-full pt-1.5 border-t border-slate-800/80 flex flex-col items-center"
                          >
                            <label
                              className={`flex items-center justify-center gap-1.5 px-1.5 py-1 rounded-lg w-full cursor-pointer transition text-[10px] font-bold border select-none ${
                                isCompleted
                                  ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950/50 hover:bg-emerald-500/35"
                                  : "bg-slate-950/80 text-slate-400 border-slate-700/70 hover:border-slate-500 hover:text-slate-200"
                              }`}
                              title={
                                isCompleted
                                  ? `Match ${proj.matchIndex} selesai (Terkunci). Klik untuk membuka kunci.`
                                  : `Tandai Match ${proj.matchIndex} sudah selesai`
                              }
                            >
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={(e) =>
                                  handleToggleMatchCompleted(
                                    proj.matchIndex,
                                    e.target.checked
                                  )
                                }
                                className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                              />
                              <span className="truncate">
                                {isCompleted ? "Selesai ✓" : "Selesai"}
                              </span>
                            </label>
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
                          const isCompleted = Boolean(completedMatches[proj.matchIndex]);
                          const courtCode = proj.playerCourts[player.id];

                          if (courtCode) {
                            const cNum = parseInt(courtCode.replace("c", "")) || 1;
                            const theme = COURT_THEMES[cNum] || COURT_THEMES[1];
                            return (
                              <td
                                key={proj.matchIndex}
                                onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                                className={`py-2 px-2 text-center border-r border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                                  isCompleted ? "bg-emerald-950/15" : ""
                                }`}
                              >
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-md text-xs font-black tracking-wider uppercase border shadow-sm ${theme.badgeClass}`}
                                >
                                  {theme.code}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={proj.matchIndex}
                              onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                              className={`py-2 px-2 text-center border-r border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                                isCompleted ? "bg-emerald-950/15" : ""
                              }`}
                            >
                              <span className="text-slate-700 select-none font-black text-xs">
                                -
                              </span>
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
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <span>👑 Pemain Admin: Hanya bermain jika di-setting manual pada match</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Prioritas: Zero Starvation &amp; Kesetaraan Level (Maks. beda 2 level)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span>🔒 Match Selesai: Mengunci formasi agar penambahan pemain melanjutkan rotasi secara adil</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              💡 Pemain baru setelah Match 3 tidak wajib main 3x; rotasi normal &amp; level tetap diprioritaskan.
            </div>
          </div>
        </section>
        )}
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
        courtCount={courtCount}
        onSaveOverride={handleSaveOverride}
        onResetOverride={handleResetSingleOverride}
        courtShuttlecocks={
          selectedMatchIdx !== null
            ? matchCourtShuttlecocks[selectedMatchIdx] || {}
            : {}
        }
        onUpdateCourtShuttlecock={handleUpdateCourtShuttlecock}
        isCompleted={Boolean(selectedMatchIdx && completedMatches[selectedMatchIdx])}
        onToggleCompleted={handleToggleMatchCompleted}
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
