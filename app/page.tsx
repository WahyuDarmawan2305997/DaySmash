"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";

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
  level: number | null; // 1 (Pemula) - 5 (Mahir), atau null untuk Admin (Bebas Level)
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
  isOverridden?: boolean; // Apakah pertandingan di lapangan ini dimodifikasi manual
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
  overriddenCourts?: Record<number, boolean>; // Catatan spesifik court mana saja yang dimodifikasi manual
}

/**
 * Data Shuttlecock per Lapangan pada tiap Match (misal: court1: 2, court2: 1, ...)
 */
export type CourtShuttlecockData = Record<string, number>;

/**
 * Data Hasil Pertandingan & Penunjukan Wasit per Lapangan
 * Key format: `${matchIndex}_c${courtNumber}` (misal: "1_c1", "1_c2")
 */
export interface CourtResult {
  losingTeam: "teamA" | "teamB";
  refereePlayerId: string; // ID pemain dari tim yang kalah yang ditunjuk jadi wasit
  refereeForMatch: number; // Match index di mana orang ini bertugas jadi wasit (misal matchIndex + 1)
  assignedAt?: string;
}

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
    badgeClass: "bg-[#7B9F97] text-white border border-[#6E8F88]",
    borderClass: "border-[#7B9F97]/50",
    textClass: "text-[#23584E]",
    bgHeaderClass: "bg-[#7B9F97]/20 text-[#23584E]",
    bgSubtleClass: "bg-[#7B9F97] text-white border-[#6E8F88]",
    accentBg: "bg-[#7B9F97]",
    accentHover: "hover:bg-[#6E8F88]",
    accentText: "text-white",
  },
  2: {
    name: "Lapangan 2",
    key: "court2",
    code: "c2",
    badgeClass: "bg-[#B9756E] text-white border border-[#A8645E]",
    borderClass: "border-[#B9756E]/50",
    textClass: "text-[#873832]",
    bgHeaderClass: "bg-[#B9756E]/20 text-[#873832]",
    bgSubtleClass: "bg-[#B9756E] text-white border-[#A8645E]",
    accentBg: "bg-[#B9756E]",
    accentHover: "hover:bg-[#A8645E]",
    accentText: "text-white",
  },
  3: {
    name: "Lapangan 3",
    key: "court3",
    code: "c3",
    badgeClass: "bg-[#CAA061] text-white border border-[#B98F52]",
    borderClass: "border-[#CAA061]/50",
    textClass: "text-[#855D21]",
    bgHeaderClass: "bg-[#CAA061]/20 text-[#855D21]",
    bgSubtleClass: "bg-[#CAA061] text-white border-[#B98F52]",
    accentBg: "bg-[#CAA061]",
    accentHover: "hover:bg-[#B98F52]",
    accentText: "text-white",
  },
  4: {
    name: "Lapangan 4",
    key: "court4",
    code: "c4",
    badgeClass: "bg-[#6B90B8] text-white border border-[#587EA6]",
    borderClass: "border-[#6B90B8]/50",
    textClass: "text-[#2D547D]",
    bgHeaderClass: "bg-[#6B90B8]/20 text-[#2D547D]",
    bgSubtleClass: "bg-[#6B90B8] text-white border-[#587EA6]",
    accentBg: "bg-[#6B90B8]",
    accentHover: "hover:bg-[#587EA6]",
    accentText: "text-white",
  },
  5: {
    name: "Lapangan 5",
    key: "court5",
    code: "c5",
    badgeClass: "bg-[#967EB5] text-white border border-[#846AA6]",
    borderClass: "border-[#967EB5]/50",
    textClass: "text-[#5C427E]",
    bgHeaderClass: "bg-[#967EB5]/20 text-[#5C427E]",
    bgSubtleClass: "bg-[#967EB5] text-white border-[#846AA6]",
    accentBg: "bg-[#967EB5]",
    accentHover: "hover:bg-[#846AA6]",
    accentText: "text-white",
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
    level: null,
    isPresent: true,
    arrivalOrder: 1,
    isAdmin: true,
  },
  // Daftar Pemain Reguler (A s/d P: 16 pemain, kelipatan 8 dari 2 lapangan default)
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
];

// ============================================================================
// 2b. PERSISTENCE — LOCALSTORAGE AUTOSAVE & BACKUP
// ============================================================================

const STORAGE_KEY = "daysmash_session";

interface SessionData {
  players: Player[];
  projectedMatchCount: number;
  courtCount: number;
  overrides: Record<number, MatchOverride>;
  completedMatches: Record<number, CompletedMatchInfo>;
  completedCourts: Record<string, boolean>;
  matchCourtShuttlecocks: Record<number, CourtShuttlecockData>;
  customFees: Record<string, number>;
  paymentStatuses: Record<string, "QRIS" | "Cash" | "">;
  courtPrice: number;
  shuttlecockPrice: number;
  courtResults?: Record<string, CourtResult>;
}

function loadSession(): Partial<SessionData> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SessionData>;
  } catch {
    return null;
  }
}

function saveSession(data: SessionData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded — silently fail
  }
}

function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}

/**
 * Validasi dasar bahwa objek yang diimport memiliki field yang diharapkan.
 */
function isValidSessionData(data: unknown): data is SessionData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.players) &&
    d.players.length > 0 &&
    typeof d.courtCount === "number" &&
    typeof d.projectedMatchCount === "number"
  );
}

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

  const levelTeamA = (teamA[0].level ?? 0) + (teamA[1].level ?? 0);
  const levelTeamB = (teamB[0].level ?? 0) + (teamB[1].level ?? 0);
  const hasAdmin = teamA.some((p) => p.isAdmin) || teamB.some((p) => p.isAdmin);
  const levelGap = hasAdmin ? 0 : Math.abs(levelTeamA - levelTeamB);

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
  const sorted = [...selectedPlayers].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));

  // Inisialisasi awal berjenjang: Court 0 dapat 4 teratas, Court 1 dapat 4 berikutnya, dst.
  const courtGroups: Player[][] = [];
  for (let c = 0; c < courtCount; c++) {
    courtGroups.push(sorted.slice(c * 4, c * 4 + 4));
  }

  const bestCourts = courtGroups;
  const bestCourtOpt = bestCourts.map((group) =>
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
            if (Math.abs((playerA.level ?? 0) - (playerB.level ?? 0)) > 1) continue;

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
      const courtsResult: (CourtMatch | null)[] = Array(courtCount).fill(null);
      const unassignedCourtNums: number[] = [];

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
            const hasAdmin = Boolean(pA1.isAdmin || pA2.isAdmin || pB1.isAdmin || pB2.isAdmin);
            const teamALvl = (pA1.level ?? 0) + (pA2.level ?? 0);
            const teamBLvl = (pB1.level ?? 0) + (pB2.level ?? 0);
            const levelDiff = hasAdmin ? 0 : Math.abs(teamALvl - teamBLvl);
            const isCourtOverridden = Boolean(overrides[m]?.overriddenCourts?.[c]);

            courtsResult[c - 1] = {
              courtNumber: c,
              teamA: { player1Id: a1, player2Id: a2 },
              teamB: { player1Id: b1, player2Id: b2 },
              teamALevel: teamALvl,
              teamBLevel: teamBLvl,
              levelDiff,
              isOverridden: isCourtOverridden,
            };
            playingIds.add(a1);
            playingIds.add(a2);
            playingIds.add(b1);
            playingIds.add(b2);
            continue;
          }
        }
        unassignedCourtNums.push(c);
      }

      // Untuk lapangan yang belum terisi (tidak di-override manual), isi otomatis dari sisa pemain reguler
      if (unassignedCourtNums.length > 0) {
        const remainingEligible = activePlayers.filter(
          (p) => !p.isAdmin && !playingIds.has(p.id)
        );

        const scoredRemaining = remainingEligible.map((p) => {
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

        scoredRemaining.sort((a, b) => b.score - a.score);
        const remainingPool = scoredRemaining.map((item) => item.player);

        for (const cNum of unassignedCourtNums) {
          if (remainingPool.length >= 4) {
            const courtCandidates = remainingPool.splice(0, 4) as [
              Player,
              Player,
              Player,
              Player
            ];
            const opt = optimizeCourtPairing(
              courtCandidates,
              m,
              partnerHistory,
              opponentHistory
            );

            const teamALvl = (opt.teamA[0].level ?? 0) + (opt.teamA[1].level ?? 0);
            const teamBLvl = (opt.teamB[0].level ?? 0) + (opt.teamB[1].level ?? 0);

            courtsResult[cNum - 1] = {
              courtNumber: cNum,
              teamA: { player1Id: opt.teamA[0].id, player2Id: opt.teamA[1].id },
              teamB: { player1Id: opt.teamB[0].id, player2Id: opt.teamB[1].id },
              teamALevel: teamALvl,
              teamBLevel: teamBLvl,
              levelDiff: Math.abs(teamALvl - teamBLvl),
              isOverridden: false,
            };

            courtCandidates.forEach((p) => playingIds.add(p.id));
          } else {
            courtsResult[cNum - 1] = null;
          }
        }
      }

      courtsResult.forEach((cm) => courtMatches.push(cm));
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

        const teamALvl = (opt.teamA[0].level ?? 0) + (opt.teamA[1].level ?? 0);
        const teamBLvl = (opt.teamB[0].level ?? 0) + (opt.teamB[1].level ?? 0);

        courtMatches.push({
          courtNumber: 1,
          teamA: { player1Id: opt.teamA[0].id, player2Id: opt.teamA[1].id },
          teamB: { player1Id: opt.teamB[0].id, player2Id: opt.teamB[1].id },
          teamALevel: teamALvl,
          teamBLevel: teamBLvl,
          levelDiff: Math.abs(teamALvl - teamBLvl),
          isOverridden: false,
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

        const c1ALvl = (opt.court1.teamA[0].level ?? 0) + (opt.court1.teamA[1].level ?? 0);
        const c1BLvl = (opt.court1.teamB[0].level ?? 0) + (opt.court1.teamB[1].level ?? 0);

        const c2ALvl = (opt.court2.teamA[0].level ?? 0) + (opt.court2.teamA[1].level ?? 0);
        const c2BLvl = (opt.court2.teamB[0].level ?? 0) + (opt.court2.teamB[1].level ?? 0);

        courtMatches.push({
          courtNumber: 1,
          teamA: { player1Id: opt.court1.teamA[0].id, player2Id: opt.court1.teamA[1].id },
          teamB: { player1Id: opt.court1.teamB[0].id, player2Id: opt.court1.teamB[1].id },
          teamALevel: c1ALvl,
          teamBLevel: c1BLvl,
          levelDiff: Math.abs(c1ALvl - c1BLvl),
          isOverridden: false,
        });

        courtMatches.push({
          courtNumber: 2,
          teamA: { player1Id: opt.court2.teamA[0].id, player2Id: opt.court2.teamA[1].id },
          teamB: { player1Id: opt.court2.teamB[0].id, player2Id: opt.court2.teamB[1].id },
          teamALevel: c2ALvl,
          teamBLevel: c2BLvl,
          levelDiff: Math.abs(c2ALvl - c2BLvl),
          isOverridden: false,
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
          const tALvl = (opt.teamA[0].level ?? 0) + (opt.teamA[1].level ?? 0);
          const tBLvl = (opt.teamB[0].level ?? 0) + (opt.teamB[1].level ?? 0);

          courtMatches.push({
            courtNumber: i + 1,
            teamA: { player1Id: opt.teamA[0].id, player2Id: opt.teamA[1].id },
            teamB: { player1Id: opt.teamB[0].id, player2Id: opt.teamB[1].id },
            teamALevel: tALvl,
            teamBLevel: tBLvl,
            levelDiff: Math.abs(tALvl - tBLvl),
            isOverridden: false,
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
  // Simpan baseline formasi awal saat modal dibuka untuk mendeteksi perubahan per lapangan
  const [baselineCourts, setBaselineCourts] = useState<
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
    setBaselineCourts(initialEdit);
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
      overriddenCourts: {},
    };

    const allSelectedPlayerIds: string[] = [];
    let filledCourtsCount = 0;

    for (let c = 1; c <= courtCount; c++) {
      const ec = editCourts[c];
      const base = baselineCourts[c];
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

        // Deteksi apakah formasi lapangan ini berbeda dari baseline atau lapangan ini memang sudah dimodifikasi
        const isModified =
          !base ||
          ec.a1 !== base.a1 ||
          ec.a2 !== base.a2 ||
          ec.b1 !== base.b1 ||
          ec.b2 !== base.b2;
        const wasCourtOverridden = Boolean(
          projection.courts?.[c - 1]?.isOverridden
        );

        overrideObj.overriddenCourts![c] = isModified || wasCourtOverridden;
      } else {
        overrideObj.courts![c] = null;
        if (c === 1) overrideObj.court1 = null;
        if (c === 2) overrideObj.court2 = null;
        if (c === 3) overrideObj.court3 = null;
        if (c === 4) overrideObj.court4 = null;
        if (c === 5) overrideObj.court5 = null;
        overrideObj.overriddenCourts![c] = false;
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
                              {p.isAdmin ? `👑 ${p.name} - ${getPlayerStatusInMatch(p)}` : `${p.name} (Lvl ${p.level}) - ${getPlayerStatusInMatch(p)}`}
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
                              {p.isAdmin ? `👑 ${p.name} - ${getPlayerStatusInMatch(p)}` : `${p.name} (Lvl ${p.level}) - ${getPlayerStatusInMatch(p)}`}
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
                              {p.isAdmin ? `👑 ${p.name} - ${getPlayerStatusInMatch(p)}` : `${p.name} (Lvl ${p.level}) - ${getPlayerStatusInMatch(p)}`}
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
                              {p.isAdmin ? `👑 ${p.name} - ${getPlayerStatusInMatch(p)}` : `${p.name} (Lvl ${p.level}) - ${getPlayerStatusInMatch(p)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : courtMatch ? (
                    (() => {
                      const pA1 = playerMap.get(courtMatch.teamA.player1Id);
                      const pA2 = playerMap.get(courtMatch.teamA.player2Id);
                      const pB1 = playerMap.get(courtMatch.teamB.player1Id);
                      const pB2 = playerMap.get(courtMatch.teamB.player2Id);
                      const hasAdminInCourt = Boolean(pA1?.isAdmin || pA2?.isAdmin || pB1?.isAdmin || pB2?.isAdmin);

                      const getPlayerLvlBadge = (p?: Player) => {
                        if (!p) return "";
                        if (p.isAdmin) return "[👑 Host]";
                        return `[L${p.level ?? "-"}]`;
                      };

                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-900/90 rounded-xl border border-slate-800/80">
                          <div className="flex-1 text-center sm:text-left">
                            <div className="text-xs text-slate-400 font-semibold mb-1">
                              TIM A (Level: {hasAdminInCourt ? "Setara 👑" : courtMatch.teamALevel})
                            </div>
                            <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                              {pA1?.isAdmin && <span>👑</span>}
                              <span>{pA1?.name}</span>
                              <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                                {getPlayerLvlBadge(pA1)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-start justify-center">
                              {pA2?.isAdmin && <span>👑</span>}
                              <span>{pA2?.name}</span>
                              <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                                {getPlayerLvlBadge(pA2)}
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
                                hasAdminInCourt || courtMatch.levelDiff <= 2
                                  ? `${theme.bgHeaderClass} ${theme.borderClass}`
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {hasAdminInCourt
                                ? "Δ 0 Lvl (Setara 👑) ✓"
                                : `Δ ${courtMatch.levelDiff} Lvl ${courtMatch.levelDiff <= 2 ? "✓" : "⚠️"}`}
                            </span>
                          </div>

                          <div className="flex-1 text-center sm:text-right">
                            <div className="text-xs text-slate-400 font-semibold mb-1">
                              TIM B (Level: {hasAdminInCourt ? "Setara 👑" : courtMatch.teamBLevel})
                            </div>
                            <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                              {pB1?.isAdmin && <span>👑</span>}
                              <span>{pB1?.name}</span>
                              <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                                {getPlayerLvlBadge(pB1)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white flex items-center gap-1 sm:justify-end justify-center">
                              {pB2?.isAdmin && <span>👑</span>}
                              <span>{pB2?.name}</span>
                              <span className={`${theme.textClass} text-xs ml-1 font-mono`}>
                                {getPlayerLvlBadge(pB2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
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
// MODAL EDIT SINGLE COURT (EDIT FORMASI SATU LAPANGAN)
// ============================================================================

interface EditSingleCourtModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchIndex: number;
  courtNum: number;
  courtCount: number;
  projection: MatchProjection | null;
  activePlayers: Player[];
  playerMap: Map<string, Player>;
  isCourtCompleted: boolean;
  isCourtOverridden: boolean;
  onSave: (
    matchIdx: number,
    courtNum: number,
    courtData: { teamA: [string, string]; teamB: [string, string] }
  ) => void;
  onReset: (matchIdx: number, courtNum: number) => void;
}

const EditSingleCourtModal: React.FC<EditSingleCourtModalProps> = ({
  isOpen,
  onClose,
  matchIndex,
  courtNum,
  courtCount,
  projection,
  activePlayers,
  playerMap,
  isCourtCompleted,
  isCourtOverridden,
  onSave,
  onReset,
}) => {
  const [a1, setA1] = useState<string>("");
  const [a2, setA2] = useState<string>("");
  const [b1, setB1] = useState<string>("");
  const [b2, setB2] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !projection) return;
    setErrorMsg(null);
    const cm =
      projection.courts?.[courtNum - 1] ||
      (courtNum === 1 ? projection.court1 : courtNum === 2 ? projection.court2 : null);

    if (cm) {
      setA1(cm.teamA.player1Id || "");
      setA2(cm.teamA.player2Id || "");
      setB1(cm.teamB.player1Id || "");
      setB2(cm.teamB.player2Id || "");
    } else {
      setA1("");
      setA2("");
      setB1("");
      setB2("");
    }
  }, [isOpen, projection, courtNum]);

  if (!isOpen || !projection) return null;

  const theme = COURT_THEMES[courtNum] || COURT_THEMES[1];

  const pA1 = a1 ? playerMap.get(a1) : null;
  const pA2 = a2 ? playerMap.get(a2) : null;
  const pB1 = b1 ? playerMap.get(b1) : null;
  const pB2 = b2 ? playerMap.get(b2) : null;

  const hasAdmin = Boolean(pA1?.isAdmin || pA2?.isAdmin || pB1?.isAdmin || pB2?.isAdmin);
  const teamALevel = (pA1?.level ?? 0) + (pA2?.level ?? 0);
  const teamBLevel = (pB1?.level ?? 0) + (pB2?.level ?? 0);
  const levelDiff = hasAdmin ? 0 : Math.abs(teamALevel - teamBLevel);
  const isFull = Boolean(a1 && a2 && b1 && b2);

  const handleSave = () => {
    setErrorMsg(null);
    if (!a1 || !a2 || !b1 || !b2) {
      setErrorMsg("Harap pilih 4 pemain lengkap (Tim A dan Tim B)!");
      return;
    }

    const uniqueSelected = new Set([a1, a2, b1, b2]);
    if (uniqueSelected.size !== 4) {
      setErrorMsg("Pemain tidak boleh dipilih ganda dalam lapangan yang sama!");
      return;
    }

    onSave(matchIndex, courtNum, {
      teamA: [a1, a2],
      teamB: [b1, b2],
    });
    onClose();
  };

  const handleReset = () => {
    onReset(matchIndex, courtNum);
    onClose();
  };

  const getPlayerOptionLabel = (player: Player, currentSlotValue: string) => {
    let note = "";
    // Cek apakah pemain sudah dipilih pada slot lain di lapangan ini
    const otherSelected = [a1, a2, b1, b2].filter((id) => id && id !== currentSlotValue);
    if (otherSelected.includes(player.id)) {
      note = " (sudah dipilih di lapangan ini)";
    } else {
      // Cek apakah pemain sedang di lapangan lain pada match ini
      let playingOther = false;
      for (let c = 1; c <= courtCount; c++) {
        if (c === courtNum) continue;
        const otherCm = projection.courts?.[c - 1];
        if (
          otherCm &&
          [
            otherCm.teamA.player1Id,
            otherCm.teamA.player2Id,
            otherCm.teamB.player1Id,
            otherCm.teamB.player2Id,
          ].includes(player.id)
        ) {
          playingOther = true;
          break;
        }
      }
      if (playingOther) {
        note = " (sedang di Lapangan lain)";
      } else if (!player.isAdmin) {
        const wait = projection.waitCountsSnapshot?.[player.id] ?? 0;
        note = ` (tunggu ${wait}x)`;
      }
    }

    if (player.isAdmin) {
      return `👑 ${player.name}${note}`;
    }
    return `${player.name} (Lvl ${player.level})${note}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-emerald-400/15 border border-emerald-400/30 text-emerald-200">
              M{matchIndex}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${theme.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`}></span>
              {theme.name}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Edit Lapangan {courtNum}
                {isCourtOverridden && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/30 font-semibold">
                    Override
                  </span>
                )}
                {isCourtCompleted && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-200 border border-emerald-400/30 font-semibold">
                    ✓ Selesai
                  </span>
                )}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Atur 4 pemain khusus lapangan ini. Lapangan lain dalam Match {matchIndex} tidak akan terhapus dan tetap terisi otomatis.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tim A */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>Tim A</span>
                {!hasAdmin && pA1 && pA2 && (
                  <span className="font-mono text-[11px] text-slate-400">
                    Total Lvl: {teamALevel}
                  </span>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Pemain 1
                </label>
                <select
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">-- Pilih Pemain 1 --</option>
                  {activePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPlayerOptionLabel(p, a1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Pemain 2
                </label>
                <select
                  value={a2}
                  onChange={(e) => setA2(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">-- Pilih Pemain 2 --</option>
                  {activePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPlayerOptionLabel(p, a2)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tim B */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-sky-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                <span>Tim B</span>
                {!hasAdmin && pB1 && pB2 && (
                  <span className="font-mono text-[11px] text-slate-400">
                    Total Lvl: {teamBLevel}
                  </span>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Pemain 1
                </label>
                <select
                  value={b1}
                  onChange={(e) => setB1(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">-- Pilih Pemain 1 --</option>
                  {activePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPlayerOptionLabel(p, b1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Pemain 2
                </label>
                <select
                  value={b2}
                  onChange={(e) => setB2(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">-- Pilih Pemain 2 --</option>
                  {activePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getPlayerOptionLabel(p, b2)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Indikator Keseimbangan & Status Admin */}
          {isFull && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
              {hasAdmin ? (
                <div className="flex items-center gap-1.5 text-purple-300 font-medium">
                  <span>👑</span>
                  <span>Ada Admin: Pertandingan otomatis Setara (Bebas Level, Selisih 0)</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-slate-300">
                    Keseimbangan Level:{" "}
                    <strong
                      className={
                        levelDiff <= 1
                          ? "text-emerald-400"
                          : levelDiff === 2
                          ? "text-amber-400"
                          : "text-rose-400"
                      }
                    >
                      Selisih {levelDiff}
                    </strong>
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      levelDiff <= 1
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : levelDiff === 2
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {levelDiff <= 1
                      ? "✨ Sangat Berimbang"
                      : levelDiff === 2
                      ? "✓ Berimbang"
                      : "⚠️ Kurang Seimbang"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <div>
            {isCourtOverridden && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition"
              >
                ↺ Reset ke Otomatis
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-sm"
            >
              Simpan Lapangan {courtNum}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL PENUNJUKAN WASIT & CATAT TIM KALAH
// ============================================================================

interface MatchRefereeModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchIndex: number;
  courtNum: number;
  courtMatch: CourtMatch | null;
  playerMap: Map<string, Player>;
  allPlayers?: Player[];
  currentResult?: CourtResult | null;
  isCourtCompleted: boolean;
  refereeStats: Record<string, number>;
  onSaveResult: (
    matchIdx: number,
    courtNum: number,
    result: { losingTeam: "teamA" | "teamB"; refereePlayerId: string },
    markCompleted: boolean
  ) => void;
  onResetResult: (matchIdx: number, courtNum: number) => void;
}

const MatchRefereeModalContent: React.FC<MatchRefereeModalProps> = ({
  onClose,
  matchIndex,
  courtNum,
  courtMatch,
  playerMap,
  allPlayers,
  currentResult,
  isCourtCompleted,
  refereeStats,
  onSaveResult,
  onResetResult,
}) => {
  const [selectedLosingTeam, setSelectedLosingTeam] = useState<"teamA" | "teamB" | null>(
    currentResult?.losingTeam || null
  );
  const [selectedRefereeId, setSelectedRefereeId] = useState<string>(
    currentResult?.refereePlayerId || ""
  );
  const [markCompleted, setMarkCompleted] = useState<boolean>(
    isCourtCompleted ? true : true
  );

  const theme = COURT_THEMES[courtNum] || COURT_THEMES[1];

  const pA1 = courtMatch?.teamA?.player1Id ? playerMap.get(courtMatch.teamA.player1Id) : null;
  const pA2 = courtMatch?.teamA?.player2Id ? playerMap.get(courtMatch.teamA.player2Id) : null;
  const pB1 = courtMatch?.teamB?.player1Id ? playerMap.get(courtMatch.teamB.player1Id) : null;
  const pB2 = courtMatch?.teamB?.player2Id ? playerMap.get(courtMatch.teamB.player2Id) : null;

  const losingPlayers = useMemo(() => {
    if (selectedLosingTeam === "teamA") {
      return [pA1, pA2].filter(Boolean) as Player[];
    }
    if (selectedLosingTeam === "teamB") {
      return [pB1, pB2].filter(Boolean) as Player[];
    }
    return [];
  }, [selectedLosingTeam, pA1, pA2, pB1, pB2]);

  const adminPlayer = useMemo(() => {
    return playerMap.get("admin") || Array.from(playerMap.values()).find((p) => p.isAdmin) || null;
  }, [playerMap]);

  const refereeCandidateOptions = useMemo(() => {
    const list = [...losingPlayers];
    if (adminPlayer && !list.some((p) => p.id === adminPlayer.id)) {
      list.push(adminPlayer);
    }
    return list;
  }, [losingPlayers, adminPlayer]);

  const participantsList = useMemo(() => {
    const base = allPlayers && allPlayers.length > 0 ? allPlayers : Array.from(playerMap.values());
    // Hanya tampilkan peserta yang diceklis hadir (atau Admin / Host)
    return base.filter((p) => p.isPresent || p.isAdmin);
  }, [allPlayers, playerMap]);

  const handleSelectLosingTeam = (team: "teamA" | "teamB") => {
    setSelectedLosingTeam(team);
    const newTeamPlayers = team === "teamA" ? [pA1?.id, pA2?.id] : [pB1?.id, pB2?.id];
    // Reset wasit terpilih jika bukan salah satu dari tim kalah yang baru DAN bukan admin
    if (!newTeamPlayers.includes(selectedRefereeId) && selectedRefereeId !== adminPlayer?.id) {
      setSelectedRefereeId("");
    }
  };

  const handleSave = () => {
    if (!selectedLosingTeam || !selectedRefereeId) return;
    onSaveResult(
      matchIndex,
      courtNum,
      {
        losingTeam: selectedLosingTeam,
        refereePlayerId: selectedRefereeId,
      },
      markCompleted
    );
  };

  const handleReset = () => {
    onResetResult(matchIndex, courtNum);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-emerald-950/20 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-black text-lg">
              ⚖️
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Hasil Match &amp; Wasit Selanjutnya</span>
              </h3>
              <p className="text-xs text-slate-400">
                Match {matchIndex} • <span className={theme.textClass}>{theme.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* LANGKAH 1: PILIH TIM YANG KALAH */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono border border-slate-700">
                  1
                </span>
                <span>Tandai Tim yang Kalah</span>
              </label>
              <span className="text-[11px] text-slate-400 italic">
                Klik salah satu tim di bawah
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card Tim A */}
              <button
                type="button"
                onClick={() => handleSelectLosingTeam("teamA")}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative ${
                  selectedLosingTeam === "teamA"
                    ? "bg-rose-950/30 border-rose-500/80 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/60"
                    : selectedLosingTeam === "teamB"
                    ? "bg-emerald-950/20 border-emerald-500/40 opacity-90"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-300">Tim A</span>
                  {selectedLosingTeam === "teamA" ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                      ❌ Kalah
                    </span>
                  ) : selectedLosingTeam === "teamB" ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      🏆 Menang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Pilih</span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                    {pA1?.isAdmin && <span>👑</span>}
                    <span>{pA1?.name || "-"}</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      (L{pA1?.level ?? "-"})
                    </span>
                  </div>
                  <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                    {pA2?.isAdmin && <span>👑</span>}
                    <span>{pA2?.name || "-"}</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      (L{pA2?.level ?? "-"})
                    </span>
                  </div>
                </div>
              </button>

              {/* Card Tim B */}
              <button
                type="button"
                onClick={() => handleSelectLosingTeam("teamB")}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative ${
                  selectedLosingTeam === "teamB"
                    ? "bg-rose-950/30 border-rose-500/80 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/60"
                    : selectedLosingTeam === "teamA"
                    ? "bg-emerald-950/20 border-emerald-500/40 opacity-90"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-sky-300">Tim B</span>
                  {selectedLosingTeam === "teamB" ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                      ❌ Kalah
                    </span>
                  ) : selectedLosingTeam === "teamA" ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      🏆 Menang
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Pilih</span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                    {pB1?.isAdmin && <span>👑</span>}
                    <span>{pB1?.name || "-"}</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      (L{pB1?.level ?? "-"})
                    </span>
                  </div>
                  <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                    {pB2?.isAdmin && <span>👑</span>}
                    <span>{pB2?.name || "-"}</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      (L{pB2?.level ?? "-"})
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* LANGKAH 2: PILIH WASIT DARI ORANG YANG KALAH ATAU ADMIN */}
          {selectedLosingTeam && refereeCandidateOptions.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px] font-mono border border-amber-400/40">
                    2
                  </span>
                  <span>Pilih Wasit untuk Match {matchIndex + 1}</span>
                </label>
                <span className="text-[11px] text-amber-300/80">
                  {refereeCandidateOptions.length} Opsi Tersedia
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tunjuk salah satu orang dari tim yang kalah atau Admin (Host) untuk bertugas sebagai wasit di pertandingan selanjutnya.
              </p>

              <div className="space-y-2">
                {refereeCandidateOptions.map((player) => {
                  const wasitCount = refereeStats[player.id] || 0;
                  const isSelected = selectedRefereeId === player.id;
                  const otherLosingPlayer = losingPlayers.find((p) => p.id !== player.id);
                  const isRecommended =
                    !player.isAdmin &&
                    otherLosingPlayer &&
                    wasitCount < (refereeStats[otherLosingPlayer.id] || 0);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setSelectedRefereeId(player.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-amber-400/15 border-amber-400/60 ring-1 ring-amber-400/40 shadow-sm shadow-amber-950/30"
                          : player.isAdmin
                          ? "bg-purple-950/20 border-purple-800/50 hover:border-purple-600/60 hover:bg-purple-900/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                            isSelected
                              ? "border-amber-400 bg-amber-400"
                              : "border-slate-600 bg-slate-900"
                          }`}
                        >
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-1.5">
                            {player.isAdmin && <span>👑</span>}
                            <span>{player.name}</span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {player.isAdmin ? "[Host]" : `[Lvl ${player.level ?? 1}]`}
                            </span>
                            {player.isAdmin && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold">
                                Opsi Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>
                              Riwayat wasit:{" "}
                              <strong className="text-amber-300 font-bold">
                                {wasitCount}x
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {isRecommended && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold shrink-0">
                          ⭐ Rekomendasi (Paling Jarang)
                        </span>
                      )}
                      {player.isAdmin && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-semibold shrink-0">
                          👑 Admin (Host)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* OPSI AUTO-SELESAI */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300 cursor-pointer select-none hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={markCompleted}
                onChange={(e) => setMarkCompleted(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <span>Tandai pertandingan Match {matchIndex} Lapangan {courtNum} sebagai Selesai</span>
            </label>
          </div>

          {/* TABEL DATA REKAP FREKUENSI WASIT PESERTA (READ-ONLY, TANPA INNER SCROLL) */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>📋</span>
                <span>Data Peserta &amp; Frekuensi Wasit</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                (Peserta Hadir • {participantsList.length} Pemain)
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-inner">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">No</th>
                    <th className="py-2 px-3">Nama Peserta</th>
                    <th className="py-2 px-2 text-center">Level</th>
                    <th className="py-2 px-3 text-right">Sudah Jadi Wasit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {participantsList.map((player, idx) => {
                    const count = refereeStats[player.id] || 0;
                    const isLosingTeamMember = losingPlayers.some((p) => p.id === player.id);
                    const isSelectedWasit = selectedRefereeId === player.id;
                    const isAbsent = !player.isPresent && !player.isAdmin;

                    return (
                      <tr
                        key={player.id}
                        className={`transition-colors ${
                          isAbsent
                            ? "opacity-40 text-slate-500 bg-slate-950/40"
                            : isSelectedWasit
                            ? "bg-amber-400/10 text-amber-200"
                            : isLosingTeamMember
                            ? "bg-slate-900/40 hover:bg-slate-800/40"
                            : "hover:bg-slate-900/30"
                        }`}
                      >
                        <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-slate-200">
                          <div className="flex items-center gap-1.5">
                            {player.isAdmin && <span>👑</span>}
                            <span className={player.isAdmin ? "text-purple-300" : isAbsent ? "text-slate-500 line-through" : ""}>
                              {player.name}
                            </span>
                            {player.isAdmin && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-normal">
                                Host
                              </span>
                            )}
                            {isLosingTeamMember && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/15 text-rose-300 font-normal">
                                Kalah M{matchIndex}
                              </span>
                            )}
                            {isSelectedWasit && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold">
                                Dipilih Wasit
                              </span>
                            )}
                            {isAbsent && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-500 font-normal">
                                Tidak Hadir
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-400 text-[11px] font-mono">
                          {player.isAdmin ? "-" : `L${player.level ?? 1}`}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-mono font-bold ${
                              count > 0
                                ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                                : "text-slate-500"
                            }`}
                          >
                            <span>{count}x</span>
                            {count > 0 && <span className="text-[9px]">⚖️</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <div>
            {currentResult && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition cursor-pointer"
              >
                ↺ Hapus / Reset Hasil
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedLosingTeam || !selectedRefereeId}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 transition shadow-sm cursor-pointer"
            >
              Simpan Hasil &amp; Wasit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MatchRefereeModal: React.FC<MatchRefereeModalProps> = (props) => {
  if (!props.isOpen || !props.courtMatch) return null;
  return (
    <MatchRefereeModalContent
      key={`${props.matchIndex}_c${props.courtNum}_${props.isOpen}`}
      {...props}
    />
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
// MODAL LAPORAN KEUANGAN & KEUNTUNGAN BERSIH
// ============================================================================

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalKas: number;
  totalPemasukanTerbayar: number;
  courtPrice: number;
  setCourtPrice: (val: number) => void;
  courtCount: number;
  shuttlecockPrice: number;
  setShuttlecockPrice: (val: number) => void;
  totalSessionShuttlecocks: number;
  presentPlayers: Player[];
  paymentStatuses: Record<string, "QRIS" | "Cash" | "">;
  playerStatsMap: Map<
    string,
    {
      matchesPlayed: number;
      shuttlecockCount: number;
      fee: number;
      autoFee: number;
      isCustom: boolean;
    }
  >;
  onUpdatePaymentStatus: (playerId: string, status: "QRIS" | "Cash" | "") => void;
  qrisPaidCount: number;
  cashPaidCount: number;
  totalPaidCount: number;
  regularPresent: number;
}

const FinanceModal: React.FC<FinanceModalProps> = ({
  isOpen,
  onClose,
  totalKas,
  totalPemasukanTerbayar,
  courtPrice,
  setCourtPrice,
  courtCount,
  shuttlecockPrice,
  setShuttlecockPrice,
  totalSessionShuttlecocks,
  presentPlayers,
  paymentStatuses,
  playerStatsMap,
  onUpdatePaymentStatus,
  qrisPaidCount,
  cashPaidCount,
  totalPaidCount,
  regularPresent,
}) => {
  if (!isOpen) return null;

  const totalPengeluaranLapangan = courtPrice * courtCount;
  const totalPengeluaranShuttlecock = shuttlecockPrice * totalSessionShuttlecocks;
  const totalPengeluaran = totalPengeluaranLapangan + totalPengeluaranShuttlecock;
  const keuntunganBersih = totalPemasukanTerbayar - totalPengeluaran;
  const proyeksiKeuntunganBersih = totalKas - totalPengeluaran;

  const isSurplus = keuntunganBersih >= 0;
  const isProyeksiSurplus = proyeksiKeuntunganBersih >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💰</span>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Laporan Keuangan &amp; Keuntungan Bersih</span>
              </h3>
              <p className="text-xs text-slate-400">
                Perhitungan pemasukan pemain terbayar, biaya sewa lapangan &amp; kok.
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

        {/* 3 Kartu Ringkasan: Pemasukan, Pengeluaran, Keuntungan Bersih */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Kartu 1: Pemasukan */}
          <div className="bg-slate-950/70 border border-emerald-400/20 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                <span>📥 Pemasukan</span>
              </div>
              <div className="text-lg font-bold text-emerald-300 mt-1">
                Rp {totalPemasukanTerbayar.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
              <div>
                <strong className="text-slate-200 font-semibold">{totalPaidCount}</strong> dari {regularPresent} pemain terbayar
              </div>
              <div className="text-[10px] text-slate-400">
                (📱 {qrisPaidCount} QRIS · 💵 {cashPaidCount} Cash)
              </div>
              <div className="text-[10px] text-slate-400 pt-0.5">
                Potensi total: Rp {totalKas.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {/* Kartu 2: Pengeluaran */}
          <div className="bg-slate-950/70 border border-rose-400/20 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                <span>📤 Pengeluaran</span>
              </div>
              <div className="text-lg font-bold text-rose-300 mt-1">
                Rp {totalPengeluaran.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
              <div>
                Lapangan: <strong className="text-slate-200">Rp {totalPengeluaranLapangan.toLocaleString("id-ID")}</strong>
              </div>
              <div>
                Shuttlecock: <strong className="text-slate-200">Rp {totalPengeluaranShuttlecock.toLocaleString("id-ID")}</strong>
              </div>
              <div className="text-[10px] text-slate-400 pt-0.5">
                ({courtCount} Lapangan · {totalSessionShuttlecocks} Kok)
              </div>
            </div>
          </div>

          {/* Kartu 3: Keuntungan Bersih */}
          <div
            className={`border rounded-xl p-3.5 flex flex-col justify-between ${
              isSurplus
                ? "bg-emerald-950/20 border-emerald-400/30"
                : "bg-rose-950/20 border-rose-400/30"
            }`}
          >
            <div>
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                  isSurplus ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                <span>{isSurplus ? "⚖️ Keuntungan Bersih" : "⚠️ Defisit Kas"}</span>
              </div>
              <div
                className={`text-lg font-bold mt-1 ${
                  isSurplus ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {isSurplus ? "+" : ""}Rp {keuntunganBersih.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
              <div className="text-[10px]">
                {isSurplus ? "✓ Kas saat ini surplus" : "⚠️ Kas masih minus"}
              </div>
              <div className="text-[10px] pt-0.5">
                Proyeksi jika semua bayar:{" "}
                <strong className={isProyeksiSurplus ? "text-emerald-300" : "text-rose-300"}>
                  {isProyeksiSurplus ? "+" : ""}Rp {proyeksiKeuntunganBersih.toLocaleString("id-ID")}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Setting Harga Manual (Harga Lapangan & Shuttlecock) */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              ⚙️ Pengaturan Harga Pengeluaran (Dapat Diubah)
            </h4>
            <button
              type="button"
              onClick={() => {
                setCourtPrice(62500);
                setShuttlecockPrice(8500);
              }}
              className="text-[11px] text-amber-300 hover:text-amber-200 transition font-medium"
            >
              ↺ Reset Default (62.5k / 8.5k)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Input Harga Lapangan */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Harga Sewa per Lapangan (Rp)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={courtPrice}
                  onChange={(e) => setCourtPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <span className="block text-[11px] text-slate-400 mt-1">
                Subtotal ({courtCount} lapangan):{" "}
                <strong className="text-slate-200">
                  Rp {totalPengeluaranLapangan.toLocaleString("id-ID")}
                </strong>
              </span>
            </div>

            {/* Input Harga Shuttlecock */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Harga per Shuttlecock (Rp)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={shuttlecockPrice}
                  onChange={(e) => setShuttlecockPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <span className="block text-[11px] text-slate-400 mt-1">
                Subtotal ({totalSessionShuttlecocks} kok terpakai):{" "}
                <strong className="text-slate-200">
                  Rp {totalPengeluaranShuttlecock.toLocaleString("id-ID")}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Tabel Ringkas Status Pembayaran Pemain */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            👥 Rincian Pembayaran per Pemain
          </h4>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Nama Pemain</th>
                  <th className="py-2 px-3 text-center">Cock / Main</th>
                  <th className="py-2 px-3 text-right">Nominal Iuran</th>
                  <th className="py-2 px-3 text-center w-28">Status Bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {presentPlayers.map((player) => {
                  const pStats = playerStatsMap.get(player.id);
                  const status = paymentStatuses[player.id] || "";
                  const isPaid = status === "QRIS" || status === "Cash";

                  if (player.isAdmin) {
                    return (
                      <tr key={player.id} className="bg-purple-950/10">
                        <td className="py-2 px-3 font-medium text-purple-300 flex items-center gap-1">
                          <span>👑 {player.name}</span>
                          <span className="text-[10px] text-slate-400">(Admin Host)</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">
                          {pStats?.shuttlecockCount || 0}🏸 / {pStats?.matchesPlayed || 0}m
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-purple-300 font-bold">
                          Gratis
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-purple-400/15 text-purple-200 border border-purple-400/30">
                            Host
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={player.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isPaid ? "bg-emerald-950/10" : ""
                      }`}
                    >
                      <td className="py-2 px-3 font-medium text-slate-200">
                        {player.name}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">
                        {pStats?.shuttlecockCount || 0}🏸 / {pStats?.matchesPlayed || 0}m
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-300">
                        Rp {(pStats?.fee || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <select
                          value={status}
                          onChange={(e) =>
                            onUpdatePaymentStatus(
                              player.id,
                              e.target.value as "QRIS" | "Cash" | ""
                            )
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border focus:outline-none cursor-pointer transition ${
                            status === "QRIS"
                              ? "bg-sky-400/15 text-sky-200 border-sky-400/35"
                              : status === "Cash"
                              ? "bg-emerald-400/15 text-emerald-200 border-emerald-400/35"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          <option value="" className="bg-slate-900 text-slate-400">
                            - Belum -
                          </option>
                          <option value="QRIS" className="bg-slate-900 text-sky-300">
                            QRIS
                          </option>
                          <option value="Cash" className="bg-slate-900 text-emerald-300">
                            Cash
                          </option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. HALAMAN UTAMA (MAIN CLIENT COMPONENT)
// ============================================================================

export default function BadmintonRotationApp() {
  // State sesi — diinisialisasi dengan default (match SSR), lalu di-restore dari localStorage via useEffect
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [projectedMatchCount, setProjectedMatchCount] = useState<number>(8);
  const [courtCount, setCourtCount] = useState<number>(2);
  const [overrides, setOverrides] = useState<Record<number, MatchOverride>>({});
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number | null>(null);

  // State Match Selesai (Terkunci)
  const [completedMatches, setCompletedMatches] = useState<
    Record<number, CompletedMatchInfo>
  >({});

  // State Selesai per Lapangan (Key: `${matchIndex}_c${courtNumber}`, Value: boolean)
  const [completedCourts, setCompletedCourts] = useState<
    Record<string, boolean>
  >({});

  // State Hasil Pertandingan & Penunjukan Wasit (Key: `${matchIndex}_c${courtNumber}`, Value: CourtResult)
  const [courtResults, setCourtResults] = useState<Record<string, CourtResult>>({});

  // State Modal Penunjukan Wasit & Hasil Pertandingan
  const [refereeModalMatch, setRefereeModalMatch] = useState<{
    matchIdx: number;
    courtNum: number;
  } | null>(null);

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

  // State Pengeluaran & Finansial (Harga Lapangan & Shuttlecock)
  const [courtPrice, setCourtPrice] = useState<number>(62500);
  const [shuttlecockPrice, setShuttlecockPrice] = useState<number>(8500);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState<boolean>(false);

  // State Modal Edit Single Court (Khusus 1 lapangan di menu pertandingan)
  const [editingCourtMatch, setEditingCourtMatch] = useState<{
    matchIdx: number;
    courtNum: number;
  } | null>(null);

  // State Tab Navigasi Menu: "pertandingan" | "spreadsheet" | "pemain"
  const [activeTab, setActiveTab] = useState<"pertandingan" | "spreadsheet" | "pemain">("pertandingan");

  // Ref untuk hidden file input (Import)
  const importInputRef = useRef<HTMLInputElement>(null);

  // State Status Pembayaran per Pemain (Key: playerId, Value: "QRIS" | "Cash" | "")
  const [paymentStatuses, setPaymentStatuses] = useState<
    Record<string, "QRIS" | "Cash" | "">
  >({});

  // Guard: jangan autosave sebelum restore dari localStorage selesai & state ter-update
  const [isRestored, setIsRestored] = useState<boolean>(false);

  // ---- RESTORE sesi dari localStorage setelah hydration (hanya client) ----
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      if (saved.players) setPlayers(saved.players);
      if (saved.projectedMatchCount !== undefined) setProjectedMatchCount(saved.projectedMatchCount);
      if (saved.courtCount !== undefined) setCourtCount(saved.courtCount);
      if (saved.overrides) setOverrides(saved.overrides);
      if (saved.completedMatches) setCompletedMatches(saved.completedMatches);
      if (saved.completedCourts) setCompletedCourts(saved.completedCourts);
      if (saved.matchCourtShuttlecocks) setMatchCourtShuttlecocks(saved.matchCourtShuttlecocks);
      if (saved.customFees) setCustomFees(saved.customFees);
      if (saved.paymentStatuses) setPaymentStatuses(saved.paymentStatuses);
      if (saved.courtPrice !== undefined) setCourtPrice(saved.courtPrice);
      if (saved.shuttlecockPrice !== undefined) setShuttlecockPrice(saved.shuttlecockPrice);
      if (saved.courtResults) setCourtResults(saved.courtResults);
    }
    setIsRestored(true);
  }, []);

  // ---- AUTOSAVE ke localStorage setiap kali data sesi berubah ----
  useEffect(() => {
    // Skip autosave pada render pertama (sebelum restore selesai)
    if (!isRestored) return;
    saveSession({
      players,
      projectedMatchCount,
      courtCount,
      overrides,
      completedMatches,
      completedCourts,
      matchCourtShuttlecocks,
      customFees,
      paymentStatuses,
      courtPrice,
      shuttlecockPrice,
      courtResults,
    });
  }, [
    isRestored,
    players, projectedMatchCount, courtCount, overrides,
    completedMatches, completedCourts, matchCourtShuttlecocks,
    customFees, paymentStatuses, courtPrice, shuttlecockPrice,
    courtResults,
  ]);

  const handleTogglePresent = useCallback((playerId: string) => {
    setPlayers((prev) => {
      const target = prev.find((p) => p.id === playerId);
      if (!target) return prev;

      const nextPresent = !target.isPresent;

      if (nextPresent) {
        // Pemain menjadi hadir: berikan arrivalOrder tertinggi saat ini + 1
        const maxArrival = prev
          .filter((p) => p.isPresent)
          .reduce((max, p) => Math.max(max, p.arrivalOrder), 0);

        return prev.map((p) =>
          p.id === playerId
            ? { ...p, isPresent: true, arrivalOrder: maxArrival + 1 }
            : p
        );
      } else {
        // Pemain menjadi tidak hadir: arrivalOrder = 0, lalu re-number yang hadir agar tidak ada celah
        const updated = prev.map((p) =>
          p.id === playerId
            ? { ...p, isPresent: false, arrivalOrder: 0 }
            : p
        );

        const presentSorted = updated
          .filter((p) => p.isPresent)
          .sort((a, b) => a.arrivalOrder - b.arrivalOrder);

        const orderMap = new Map<string, number>();
        presentSorted.forEach((p, idx) => {
          orderMap.set(p.id, idx + 1);
        });

        return updated.map((p) =>
          p.isPresent && orderMap.has(p.id)
            ? { ...p, arrivalOrder: orderMap.get(p.id)! }
            : p
        );
      }
    });
  }, []);

  const handleUpdatePlayerLevel = useCallback((playerId: string, newLevel: number | null) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, level: newLevel } : p))
    );
  }, []);

  const handleUpdatePlayerName = useCallback((playerId: string, newName: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, name: newName } : p))
    );
  }, []);

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
      // newPlayerIsPresent tetap mempertahankan pilihan terakhir user (tidak otomatis reset ke true)
    },
    [newPlayerName, newPlayerLevel, newPlayerIsPresent]
  );

  const handleDeletePlayer = useCallback(
    (playerId: string) => {
      const target = players.find((p) => p.id === playerId);
      if (!target || target.isAdmin) return;
      if (confirm(`Hapus pemain "${target.name}"?`)) {
        setPlayers((prev) => prev.filter((p) => p.id !== playerId || p.isAdmin));
      }
    },
    [players]
  );

  const handleDeleteAllPlayers = useCallback(() => {
    const nonAdminPlayers = players.filter((p) => !p.isAdmin);
    if (nonAdminPlayers.length === 0) {
      alert("Tidak ada pemain untuk dihapus (Admin/Host dilindungi).");
      return;
    }
    if (
      confirm(
        `Apakah Anda yakin ingin menghapus semua (${nonAdminPlayers.length}) pemain? Akun Admin/Host tidak akan dihapus.`
      )
    ) {
      setPlayers((prev) => prev.filter((p) => p.isAdmin));
      setCustomFees((prev) => {
        const nextFees: Record<string, number> = {};
        players.filter((p) => p.isAdmin).forEach((admin) => {
          if (prev[admin.id] !== undefined) nextFees[admin.id] = prev[admin.id];
        });
        return nextFees;
      });
      setPaymentStatuses((prev) => {
        const nextStatuses: Record<string, "QRIS" | "Cash" | ""> = {};
        players.filter((p) => p.isAdmin).forEach((admin) => {
          if (prev[admin.id]) nextStatuses[admin.id] = prev[admin.id];
        });
        return nextStatuses;
      });
    }
  }, [players]);

  const handleResetToPreset = useCallback(() => {
    if (confirm("Reset daftar pemain ke data contoh (termasuk Admin)?")) {
      setPlayers(INITIAL_PLAYERS);
      setCourtCount(2);
      setOverrides({});
      setCompletedMatches({});
      setCompletedCourts({});
      setMatchCourtShuttlecocks({});
      setCustomFees({});
      setPaymentStatuses({});
      setCourtResults({});
    }
  }, []);

  // ---- SESI MABAR BARU (reset semua + hapus localStorage) ----
  const handleNewSession = useCallback(() => {
    if (confirm("Mulai sesi mabar baru?\n\nSemua data sesi saat ini (pemain, match, pembayaran) akan dihapus.\n\nTip: Export dulu jika ingin menyimpan data sesi ini.")) {
      setPlayers(INITIAL_PLAYERS);
      setProjectedMatchCount(8);
      setCourtCount(2);
      setOverrides({});
      setCompletedMatches({});
      setCompletedCourts({});
      setMatchCourtShuttlecocks({});
      setCustomFees({});
      setPaymentStatuses({});
      setCourtPrice(62500);
      setShuttlecockPrice(8500);
      setCourtResults({});
      setSelectedMatchIdx(null);
      clearSession();
    }
  }, []);

  // ---- EXPORT DATA ke file JSON ----
  const handleExportData = useCallback(() => {
    const sessionData: SessionData = {
      players,
      projectedMatchCount,
      courtCount,
      overrides,
      completedMatches,
      completedCourts,
      matchCourtShuttlecocks,
      customFees,
      paymentStatuses,
      courtPrice,
      shuttlecockPrice,
      courtResults,
    };
    const json = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const filename = `DaySmash-${dd}-${mm}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    players, projectedMatchCount, courtCount, overrides,
    completedMatches, completedCourts, matchCourtShuttlecocks,
    customFees, paymentStatuses, courtPrice, shuttlecockPrice,
    courtResults,
  ]);

  // ---- IMPORT DATA dari file JSON ----
  const handleImportData = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);

        if (!isValidSessionData(data)) {
          alert("❌ File tidak valid.\n\nFile harus berupa backup DaySmash (.json) yang berisi data pemain, lapangan, dan match.");
          return;
        }

        if (!confirm("Import data backup?\n\nData sesi saat ini akan digantikan oleh data dari file backup.")) {
          return;
        }

        // Restore semua state dari file backup
        setPlayers(data.players);
        setProjectedMatchCount(data.projectedMatchCount);
        setCourtCount(data.courtCount);
        setOverrides(data.overrides ?? {});
        setCompletedMatches(data.completedMatches ?? {});
        setCompletedCourts(data.completedCourts ?? {});
        setMatchCourtShuttlecocks(data.matchCourtShuttlecocks ?? {});
        setCustomFees(data.customFees ?? {});
        setPaymentStatuses(data.paymentStatuses ?? {});
        setCourtPrice(data.courtPrice ?? 62500);
        setShuttlecockPrice(data.shuttlecockPrice ?? 8500);
        setCourtResults(data.courtResults ?? {});
        setSelectedMatchIdx(null);

        // Simpan juga ke localStorage
        saveSession(data);

        alert("✅ Data berhasil diimport!");
      } catch {
        alert("❌ Gagal membaca file.\n\nPastikan file berformat JSON yang valid.");
      }
    };
    reader.readAsText(file);

    // Reset input agar bisa memilih file yang sama lagi
    e.target.value = "";
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

  const handleSaveCourtOverride = useCallback(
    (
      matchIdx: number,
      courtNum: number,
      courtData: { teamA: [string, string]; teamB: [string, string] }
    ) => {
      setOverrides((prev) => {
        const currentMatchOv = prev[matchIdx] || { courts: {}, overriddenCourts: {} };
        const currentCourts = { ...(currentMatchOv.courts || {}) };
        const currentOverridden = { ...(currentMatchOv.overriddenCourts || {}) };

        currentCourts[courtNum] = courtData;
        currentOverridden[courtNum] = true;

        const nextMatchOv: MatchOverride = {
          ...currentMatchOv,
          courts: currentCourts,
          overriddenCourts: currentOverridden,
        };
        if (courtNum === 1) nextMatchOv.court1 = courtData;
        if (courtNum === 2) nextMatchOv.court2 = courtData;
        if (courtNum === 3) nextMatchOv.court3 = courtData;
        if (courtNum === 4) nextMatchOv.court4 = courtData;
        if (courtNum === 5) nextMatchOv.court5 = courtData;

        return {
          ...prev,
          [matchIdx]: nextMatchOv,
        };
      });
    },
    []
  );

  const handleResetCourtOverride = useCallback(
    (matchIdx: number, courtNum: number) => {
      setOverrides((prev) => {
        const currentMatchOv = prev[matchIdx];
        if (!currentMatchOv) return prev;

        const currentCourts = { ...(currentMatchOv.courts || {}) };
        const currentOverridden = { ...(currentMatchOv.overriddenCourts || {}) };

        delete currentCourts[courtNum];
        delete currentOverridden[courtNum];

        if (courtNum === 1) delete currentMatchOv.court1;
        if (courtNum === 2) delete currentMatchOv.court2;
        if (courtNum === 3) delete currentMatchOv.court3;
        if (courtNum === 4) delete currentMatchOv.court4;
        if (courtNum === 5) delete currentMatchOv.court5;

        const remainingKeys = Object.keys(currentCourts).filter(
          (k) => currentCourts[Number(k)] && currentOverridden[Number(k)]
        );

        if (remainingKeys.length === 0) {
          const next = { ...prev };
          delete next[matchIdx];
          return next;
        }

        return {
          ...prev,
          [matchIdx]: {
            ...currentMatchOv,
            courts: currentCourts,
            overriddenCourts: currentOverridden,
          },
        };
      });
    },
    []
  );

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

  // Urutan pemain untuk tabel Kelola Pemain:
  // Pemain yang hadir berada di atas (diurutkan berdasarkan urutan kedatangan arrivalOrder #1, #2...),
  // disusul pemain yang belum hadir di bagian bawah (sesuai urutan registrasi).
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      // Yang hadir selalu berada di atas yang belum hadir
      if (a.isPresent && !b.isPresent) return -1;
      if (!a.isPresent && b.isPresent) return 1;

      // Jika sama-sama hadir, urutkan berdasarkan arrivalOrder ascending
      if (a.isPresent && b.isPresent) {
        return a.arrivalOrder - b.arrivalOrder;
      }

      // Jika sama-sama belum hadir, pertahankan urutan aslinya
      return 0;
    });
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

  const handleToggleCourtCompleted = useCallback(
    (matchIdx: number, courtNum: number, isCompleted: boolean) => {
      const key = `${matchIdx}_c${courtNum}`;
      setCompletedCourts((prev) => {
        const next = { ...prev };
        if (isCompleted) {
          next[key] = true;
        } else {
          delete next[key];
        }

        // Cek apakah SEMUA lapangan aktif pada match ini telah selesai
        const allCourtsDone = Array.from({ length: courtCount }, (_, i) => i + 1).every(
          (c) => Boolean(next[`${matchIdx}_c${c}`])
        );

        const proj = projections.find((p) => p.matchIndex === matchIdx);
        if (proj) {
          setCompletedMatches((prevMatches) => {
            const nextMatches = { ...prevMatches };
            if (allCourtsDone) {
              nextMatches[matchIdx] = {
                matchIndex: matchIdx,
                courts: proj.courts,
                playingPlayerIds: Array.from(proj.playingPlayerIds),
                waitingPlayerIds: [...proj.waitingPlayerIds],
                completedAt: nextMatches[matchIdx]?.completedAt || new Date().toISOString(),
              };
            } else {
              delete nextMatches[matchIdx];
            }
            return nextMatches;
          });
        }

        return next;
      });
    },
    [projections, courtCount]
  );

  const handleToggleMatchCompleted = useCallback(
    (matchIdx: number, isCompleted: boolean) => {
      // Sinkronkan seluruh court aktif pada match ini
      setCompletedCourts((prev) => {
        const next = { ...prev };
        for (let c = 1; c <= courtCount; c++) {
          const key = `${matchIdx}_c${c}`;
          if (isCompleted) {
            next[key] = true;
          } else {
            delete next[key];
          }
        }
        return next;
      });

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
    [projections, courtCount]
  );

  const handleSaveCourtResult = useCallback(
    (
      matchIdx: number,
      courtNum: number,
      result: { losingTeam: "teamA" | "teamB"; refereePlayerId: string },
      markCompleted: boolean
    ) => {
      const key = `${matchIdx}_c${courtNum}`;
      setCourtResults((prev) => ({
        ...prev,
        [key]: {
          losingTeam: result.losingTeam,
          refereePlayerId: result.refereePlayerId,
          refereeForMatch: matchIdx + 1,
          assignedAt: new Date().toISOString(),
        },
      }));

      if (markCompleted) {
        handleToggleCourtCompleted(matchIdx, courtNum, true);
      }
      setRefereeModalMatch(null);
    },
    [handleToggleCourtCompleted]
  );

  const handleResetCourtResult = useCallback(
    (matchIdx: number, courtNum: number) => {
      const key = `${matchIdx}_c${courtNum}`;
      setCourtResults((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setRefereeModalMatch(null);
    },
    []
  );

  const refereeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of players) {
      counts[p.id] = 0;
    }
    for (const key of Object.keys(courtResults)) {
      const res = courtResults[key];
      if (res && res.refereePlayerId) {
        counts[res.refereePlayerId] = (counts[res.refereePlayerId] || 0) + 1;
      }
    }
    return counts;
  }, [players, courtResults]);

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

  // Total pemasukan real yang telah dibayarkan oleh pemain (QRIS / Cash)
  const totalPemasukanTerbayar = useMemo(() => {
    let sum = 0;
    for (const p of presentPlayers) {
      if (!p.isAdmin && (paymentStatuses[p.id] === "QRIS" || paymentStatuses[p.id] === "Cash")) {
        const pStats = playerStatsMap.get(p.id);
        if (pStats) sum += pStats.fee;
      }
    }
    return sum;
  }, [presentPlayers, paymentStatuses, playerStatsMap]);

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

    const completedCourtCount = Object.keys(completedCourts).filter((k) => {
      const [mStr, cStr] = k.split("_c");
      const m = parseInt(mStr);
      const c = parseInt(cStr);
      return m <= projectedMatchCount && c <= courtCount && completedCourts[k];
    }).length;
    const totalCourtMatches = projectedMatchCount * courtCount;

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
      completedCourtCount,
      totalCourtMatches,
      regularPresent,
      qrisPaidCount,
      cashPaidCount,
      totalPaidCount,
    };
  }, [presentPlayers, overrides, customFees, paymentStatuses, courtCount, completedMatches, completedCourts, projectedMatchCount]);

  const selectedProjection = useMemo(() => {
    if (!selectedMatchIdx) return null;
    return projections.find((p) => p.matchIndex === selectedMatchIdx) || null;
  }, [selectedMatchIdx, projections]);

  return (
    <div className="min-h-screen bg-[#BFCCDC] text-slate-800 font-sans selection:bg-emerald-400 selection:text-slate-950">
      {/* =====================================================================
          HEADER & BRANDING
      ====================================================================== */}
      <header className="border-b border-slate-600/40 bg-[#3B4758] backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-400/30 flex items-center justify-center bg-slate-900 shadow-sm shrink-0">
              <img
                src="/photo-logo-daysmash.jpg"
                alt="DaySmash Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                DaySmash
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#357564] text-[#A7F3D0] border border-[#43917C] uppercase tracking-wider">
                  Badminton
                </span>
              </h1>
            </div>
          </div>

          {/* Menu Navigasi Utama */}
          <div className="flex items-center bg-[#2E3947] p-1 rounded-xl border border-slate-600/40 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("pertandingan")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "pertandingan"
                  ? "bg-[#7ED1B3] text-[#133E32] shadow-sm font-black"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>🏸 Pertandingan</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === "pertandingan"
                    ? "bg-[#133E32]/20 text-[#133E32] font-mono font-bold"
                    : "bg-slate-700/80 text-slate-300 font-mono"
                }`}
              >
                M1-M{projectedMatchCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("spreadsheet")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "spreadsheet"
                  ? "bg-[#7ED1B3] text-[#133E32] shadow-sm font-black"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>📊 Rotasi Pemain</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pemain")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "pemain"
                  ? "bg-[#7ED1B3] text-[#133E32] shadow-sm font-black"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>👥 Kelola Pemain</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === "pemain"
                    ? "bg-[#133E32]/20 text-[#133E32] font-mono font-bold"
                    : "bg-slate-700/80 text-slate-300 font-mono"
                }`}
              >
                {players.length}
              </span>
            </button>
          </div>

          {/* Quick Actions & Setting Proyeksi & Lapangan */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Setting Proyeksi Match (1 s/d 18 Match) */}
            <div className="flex items-center bg-[#4C586B] border border-slate-500/50 rounded-xl px-2 py-1 gap-1 shadow-sm">
              <span className="text-xs text-slate-200 font-medium mr-1">Match:</span>
              <button
                type="button"
                onClick={() => setProjectedMatchCount((prev) => Math.max(1, prev - 1))}
                disabled={projectedMatchCount <= 1}
                className="w-5 h-5 rounded bg-[#333E4D] hover:bg-[#2A3442] disabled:opacity-30 border border-slate-600 text-white font-bold flex items-center justify-center text-xs transition cursor-pointer"
                title="Kurangi proyeksi match"
              >
                -
              </button>
              <span className="w-5 text-center text-xs font-bold text-[#7ED1B3] font-mono">
                {projectedMatchCount}
              </span>
              <button
                type="button"
                onClick={() => setProjectedMatchCount((prev) => Math.min(18, prev + 1))}
                disabled={projectedMatchCount >= 18}
                className="w-5 h-5 rounded bg-[#333E4D] hover:bg-[#2A3442] disabled:opacity-30 border border-slate-600 text-white font-bold flex items-center justify-center text-xs transition cursor-pointer"
                title="Tambah proyeksi match"
              >
                +
              </button>
            </div>

            {/* Setting Jumlah Lapangan (1 s/d 5 Lapangan) */}
            <div className="flex items-center bg-[#4C586B] border border-slate-500/50 rounded-xl px-2 py-1 gap-1 shadow-sm">
              <span className="text-xs text-slate-200 font-medium mr-1">Lap:</span>
              <button
                type="button"
                onClick={() => setCourtCount((prev) => Math.max(1, prev - 1))}
                disabled={courtCount <= 1}
                className="w-5 h-5 rounded bg-[#333E4D] hover:bg-[#2A3442] disabled:opacity-30 border border-slate-600 text-white font-bold flex items-center justify-center text-xs transition cursor-pointer"
                title="Kurangi lapangan"
              >
                -
              </button>
              <span className="w-4 text-center text-xs font-bold text-[#7ED1B3] font-mono">
                {courtCount}
              </span>
              <button
                type="button"
                onClick={() => setCourtCount((prev) => Math.min(5, prev + 1))}
                disabled={courtCount >= 5}
                className="w-5 h-5 rounded bg-[#333E4D] hover:bg-[#2A3442] disabled:opacity-30 border border-slate-600 text-white font-bold flex items-center justify-center text-xs transition cursor-pointer"
                title="Tambah lapangan"
              >
                +
              </button>
            </div>

            {stats.completedCourtCount > 0 && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Buka kunci semua (${stats.completedCourtCount}) pertandingan yang sudah selesai? Formasi akan kembali dihitung dinamis.`
                    )
                  ) {
                    setCompletedMatches({});
                    setCompletedCourts({});
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 transition flex items-center gap-1"
                title="Buka kunci semua match selesai"
              >
                <span>Reset {stats.completedCourtCount} Selesai</span>
              </button>
            )}

            {stats.overrideCount > 0 && (
              <button
                onClick={handleClearAllOverrides}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition flex items-center gap-1"
              >
                <span>Reset {stats.overrideCount} Override</span>
              </button>
            )}

            {stats.customFeeCount > 0 && (
              <button
                onClick={() => setCustomFees({})}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-purple-500/20 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30 transition flex items-center gap-1"
                title="Reset diskon"
              >
                <span>Reset Diskon</span>
              </button>
            )}

            {/* Separator */}
            <div className="w-px h-5 bg-slate-500/40" />

            {/* Export Data */}
            <button
              onClick={handleExportData}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#506B88] border border-[#6583A2] text-[#DCEAF7] hover:bg-[#435C77] transition flex items-center gap-1"
              title="Export data sesi ke file JSON"
            >
              <span>📥 Export</span>
            </button>

            {/* Import Data */}
            <button
              onClick={() => importInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#506B88] border border-[#6583A2] text-[#DCEAF7] hover:bg-[#435C77] transition flex items-center gap-1"
              title="Import data sesi dari file JSON"
            >
              <span>📤 Import</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportData}
              className="hidden"
              aria-hidden="true"
            />

            {/* Sesi Mabar Baru */}
            <button
              onClick={handleNewSession}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#784E5E] border border-[#8F5F72] text-[#FCD5DE] hover:bg-[#683E4E] transition flex items-center gap-1"
              title="Mulai sesi mabar baru (hapus semua data)"
            >
              <span>🔄 Sesi Baru</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* ===================================================================
            KPI & STATUS BAR (2 KOLOM SIMETRIS & PASTEL BERSIH)
        ==================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* KPI 1: Pemain Hadir */}
          <div className="bg-[#E7EEF4] border border-white/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#C1DED9] border border-[#A5D0C8] flex items-center justify-center text-[#236858] text-lg font-bold">
              ✓
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Pemain Hadir
              </div>
              <div className="text-xl font-bold text-slate-800">
                {stats.totalPresent}{" "}
                <span className="text-xs font-normal text-slate-500">
                  / {players.length} Terdaftar
                </span>
              </div>
            </div>
          </div>

          {/* KPI 2: Total Shuttlecock & Kas Tagihan (Klik untuk Laporan Keuangan) */}
          <div
            onClick={() => setIsFinanceModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Klik untuk melihat rincian pemasukan, pengeluaran & keuntungan bersih"
            className="bg-[#E7EEF4] hover:bg-[#DFE7EF] border border-white/80 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer transition group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EFE8D1] group-hover:bg-[#EAE1C4] border border-[#E0D4B1] flex items-center justify-center text-lg font-bold transition">
                💰
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Total Iuran Kas</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#DDD3B3] text-[#6E5F2A] font-bold group-hover:bg-[#D5C9A3] transition">
                    Laporan ↗
                  </span>
                </div>
                <div className="text-xl font-bold text-[#1E745A]">
                  Rp {totalKas.toLocaleString("id-ID")}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>{totalSessionShuttlecocks} Cock</span>
                  <span>·</span>
                  <span className="text-[#1E745A] font-semibold">
                    Bayar: {stats.totalPaidCount}/{stats.regularPresent}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            MENU TAB SWITCHER (DESKTOP & MOBILE)
        ==================================================================== */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
          <div className="flex items-center bg-[#E5ECF2] p-1.5 rounded-2xl border border-white/80 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("pertandingan")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "pertandingan"
                  ? "bg-[#9FE3D0] text-[#133E32] shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span>🏸 Pertandingan</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === "pertandingan"
                    ? "bg-[#133E32]/15 text-[#133E32]"
                    : "bg-slate-300/70 text-slate-700 font-mono"
                }`}
              >
                M1-M{projectedMatchCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("spreadsheet")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "spreadsheet"
                  ? "bg-[#9FE3D0] text-[#133E32] shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span>📊 Rotasi Pemain</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pemain")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "pemain"
                  ? "bg-[#9FE3D0] text-[#133E32] shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <span>👥 Kelola Pemain</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === "pemain"
                    ? "bg-[#133E32]/15 text-[#133E32]"
                    : "bg-slate-300/70 text-slate-700 font-mono"
                }`}
              >
                {players.length}
              </span>
            </button>
          </div>
        </div>

        {/* ===================================================================
            KONTEN TAMPILAN: TABEL PERTANDINGAN ATAU SPREADSHEET
        ==================================================================== */}
        {activeTab === "pertandingan" ? (
          <section className="bg-[#E7EEF4] border border-white/80 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
            {/* Header Tabel Pertandingan */}
            <div className="p-4 sm:px-5 border-b border-slate-300/70 flex items-center justify-between gap-3 bg-[#DFE7EF]/80">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>🏸 Pertandingan (M1 s/d M{projectedMatchCount})</span>
              </h2>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-medium">
                  {stats.completedCourtCount} Selesai
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/80 border border-slate-300 text-slate-600 font-medium">
                  {stats.totalCourtMatches - stats.completedCourtCount} Belum
                </span>
              </div>
            </div>

            {/* Tabel Pertandingan */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#DFE7EF] border-b border-slate-300/70 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3 px-4 w-20 text-center">Match</th>
                    <th className="py-3 px-4 w-40">Lapangan</th>
                    <th className="py-3 px-4 min-w-[300px]">Pertandingan (Siapa vs Siapa)</th>
                    <th className="py-3 px-4 w-36 text-center">Jumlah Kok</th>
                    <th className="py-3 px-4 w-36 text-center">Status</th>
                    <th className="py-3 px-4 w-28 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white/80">
                  {presentPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 italic text-sm">
                        Belum ada pemain yang berstatus hadir.{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("pemain")}
                          className="text-emerald-600 underline font-semibold hover:text-emerald-500 cursor-pointer not-italic"
                        >
                          Buka tab Kelola Pemain
                        </button>{" "}
                        untuk mencentang kehadiran.
                      </td>
                    </tr>
                  ) : (
                    projections.flatMap((proj) => {
                      const activeCourtsList = Array.from({ length: courtCount }, (_, i) => i + 1);

                      return activeCourtsList.map((cNum) => {
                        const theme = COURT_THEMES[cNum] || COURT_THEMES[1];
                        const courtMatch =
                          proj.courts?.[cNum - 1] ||
                          (cNum === 1 ? proj.court1 : cNum === 2 ? proj.court2 : null);
                        const cockCount =
                          matchCourtShuttlecocks[proj.matchIndex]?.[`court${cNum}`] ?? 0;

                        const courtKey = `${proj.matchIndex}_c${cNum}`;
                        const isCourtCompleted = Boolean(completedCourts[courtKey]);
                        const isCourtOverridden = Boolean(courtMatch?.isOverridden);

                        const courtResult = courtResults[courtKey];
                        const nextRefereePlayer = courtResult?.refereePlayerId
                          ? playerMap.get(courtResult.refereePlayerId)
                          : null;

                        // Wasit yang bertugas memimpin match ini (dari match sebelumnya di lapangan ini)
                        const prevCourtResult =
                          proj.matchIndex > 1
                            ? courtResults[`${proj.matchIndex - 1}_c${cNum}`]
                            : null;
                        const currentRefereePlayer = prevCourtResult?.refereePlayerId
                          ? playerMap.get(prevCourtResult.refereePlayerId)
                          : null;

                        const pA1 = courtMatch?.teamA?.player1Id ? playerMap.get(courtMatch.teamA.player1Id) : null;
                        const pA2 = courtMatch?.teamA?.player2Id ? playerMap.get(courtMatch.teamA.player2Id) : null;
                        const pB1 = courtMatch?.teamB?.player1Id ? playerMap.get(courtMatch.teamB.player1Id) : null;
                        const pB2 = courtMatch?.teamB?.player2Id ? playerMap.get(courtMatch.teamB.player2Id) : null;

                        const hasMatch = Boolean(pA1 && pA2 && pB1 && pB2);

                        return (
                          <tr
                            key={`m${proj.matchIndex}-c${cNum}`}
                            className={`transition-all duration-200 ${
                              isCourtCompleted
                                ? "bg-emerald-50/60 hover:bg-emerald-50/90 border-l-4 border-l-emerald-500 shadow-inner"
                                : "hover:bg-slate-100/60 border-l-4 border-l-transparent"
                            }`}
                          >
                            {/* Kolom Match */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                                className={`inline-flex items-center justify-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-md border transition ${
                                  isCourtCompleted
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200 shadow-sm"
                                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                                }`}
                                title={`Lihat detail seluruh Match ${proj.matchIndex}`}
                              >
                                {isCourtCompleted && (
                                  <span className="text-emerald-700 text-[11px] font-black leading-none">✓</span>
                                )}
                                <span>M{proj.matchIndex}</span>
                              </button>
                            </td>

                            {/* Kolom Lapangan */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-sm ${
                                    isCourtCompleted ? `${theme.badgeClass} opacity-85` : theme.badgeClass
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                  {theme.name}
                                </span>
                                {isCourtCompleted && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
                                    title="Pertandingan lapangan ini sudah selesai"
                                  >
                                    Selesai
                                  </span>
                                )}
                                {isCourtOverridden && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold"
                                    title="Formasi lapangan ini diedit secara manual"
                                  >
                                    Override
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Kolom Pertandingan (Siapa vs Siapa) */}
                            <td className="py-3 px-4">
                              {hasMatch ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Tim A */}
                                    <div
                                      className={`flex items-center gap-1.5 text-sm transition ${
                                        courtResult?.losingTeam === "teamA"
                                          ? "opacity-75 font-medium"
                                          : isCourtCompleted
                                          ? "font-bold"
                                          : "font-bold"
                                      }`}
                                    >
                                      <span className={courtResult?.losingTeam === "teamA" ? "text-slate-400 line-through decoration-slate-400 inline-flex items-center gap-0.5" : "text-slate-800 inline-flex items-center gap-0.5 font-bold"}>
                                        {pA1?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                        <span>{pA1?.name}</span>
                                        {courtResult?.losingTeam === "teamA" && courtResult?.refereePlayerId === pA1?.id && (
                                          <span
                                            className="ml-1 text-amber-600 not-italic no-underline font-bold text-xs select-none"
                                            title={`Ditunjuk sebagai wasit Match ${proj.matchIndex + 1}`}
                                          >
                                            ⚖️
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-slate-400 font-normal text-xs">&amp;</span>
                                      <span className={courtResult?.losingTeam === "teamA" ? "text-slate-400 line-through decoration-slate-400 inline-flex items-center gap-0.5" : "text-slate-800 inline-flex items-center gap-0.5 font-bold"}>
                                        {pA2?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                        <span>{pA2?.name}</span>
                                        {courtResult?.losingTeam === "teamA" && courtResult?.refereePlayerId === pA2?.id && (
                                          <span
                                            className="ml-1 text-amber-600 not-italic no-underline font-bold text-xs select-none"
                                            title={`Ditunjuk sebagai wasit Match ${proj.matchIndex + 1}`}
                                          >
                                            ⚖️
                                          </span>
                                        )}
                                      </span>
                                      {courtResult?.losingTeam === "teamA" ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-300 font-semibold flex items-center gap-1">
                                          <span>Kalah</span>
                                          {courtResult?.refereePlayerId === "admin" && !pA1?.isAdmin && !pA2?.isAdmin && (
                                            <span className="text-purple-700 font-bold" title={`Wasit Match ${proj.matchIndex + 1}: Admin (Host)`}>
                                              (⚖️ Admin)
                                            </span>
                                          )}
                                        </span>
                                      ) : courtResult?.losingTeam === "teamB" ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-0.5">
                                          <span>🏆</span>
                                          <span>Menang</span>
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Tombol Interaktif VS */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRefereeModalMatch({
                                          matchIdx: proj.matchIndex,
                                          courtNum: cNum,
                                        })
                                      }
                                      className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider uppercase bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200 transition cursor-pointer"
                                      title="Klik untuk tandai tim yang kalah & tentukan wasit"
                                    >
                                      VS
                                    </button>

                                    {/* Tim B */}
                                    <div
                                      className={`flex items-center gap-1.5 text-sm transition ${
                                        courtResult?.losingTeam === "teamB"
                                          ? "opacity-75 font-medium"
                                          : isCourtCompleted
                                          ? "font-bold"
                                          : "font-bold"
                                      }`}
                                    >
                                      <span className={courtResult?.losingTeam === "teamB" ? "text-slate-400 line-through decoration-slate-400 inline-flex items-center gap-0.5" : "text-slate-800 inline-flex items-center gap-0.5 font-bold"}>
                                        {pB1?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                        <span>{pB1?.name}</span>
                                        {courtResult?.losingTeam === "teamB" && courtResult?.refereePlayerId === pB1?.id && (
                                          <span
                                            className="ml-1 text-amber-600 not-italic no-underline font-bold text-xs select-none"
                                            title={`Ditunjuk sebagai wasit Match ${proj.matchIndex + 1}`}
                                          >
                                            ⚖️
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-slate-400 font-normal text-xs">&amp;</span>
                                      <span className={courtResult?.losingTeam === "teamB" ? "text-slate-400 line-through decoration-slate-400 inline-flex items-center gap-0.5" : "text-slate-800 inline-flex items-center gap-0.5 font-bold"}>
                                        {pB2?.isAdmin && <span className="mr-0.5" title="Admin / Host">👑</span>}
                                        <span>{pB2?.name}</span>
                                        {courtResult?.losingTeam === "teamB" && courtResult?.refereePlayerId === pB2?.id && (
                                          <span
                                            className="ml-1 text-amber-600 not-italic no-underline font-bold text-xs select-none"
                                            title={`Ditunjuk sebagai wasit Match ${proj.matchIndex + 1}`}
                                          >
                                            ⚖️
                                          </span>
                                        )}
                                      </span>
                                      {courtResult?.losingTeam === "teamB" ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-300 font-semibold flex items-center gap-1">
                                          <span>Kalah</span>
                                          {courtResult?.refereePlayerId === "admin" && !pB1?.isAdmin && !pB2?.isAdmin && (
                                            <span className="text-purple-700 font-bold" title={`Wasit Match ${proj.matchIndex + 1}: Admin (Host)`}>
                                              (⚖️ Admin)
                                            </span>
                                          )}
                                        </span>
                                      ) : courtResult?.losingTeam === "teamA" ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-0.5">
                                          <span>🏆</span>
                                          <span>Menang</span>
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  {/* Info Wasit yang Sedang Memimpin Match Ini */}
                                  {currentRefereePlayer && (
                                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                      <span className="inline-flex items-center gap-1 text-[11px] text-sky-800 font-medium bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-md">
                                        <span>⚖️ Dipimpin Wasit:</span>
                                        <strong className="text-sky-900">{currentRefereePlayer.name}</strong>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  - Lapangan Kosong -
                                </span>
                              )}
                            </td>

                            {/* Kolom Jumlah Kok */}
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCourtShuttlecock(
                                      proj.matchIndex,
                                      `court${cNum}`,
                                      Math.max(0, cockCount - 1)
                                    )
                                  }
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold transition active:scale-95 disabled:opacity-30 cursor-pointer"
                                  title="Kurangi kok"
                                  disabled={cockCount <= 0}
                                >
                                  -
                                </button>
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-300 min-w-[50px] justify-center">
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
                                    className="w-6 bg-transparent text-center font-mono font-bold text-slate-800 text-xs focus:outline-none"
                                  />
                                  <span className="text-[11px]" title="Shuttlecock">🏸</span>
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
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold transition active:scale-95 cursor-pointer"
                                  title="Tambah kok"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Kolom Status Pertandingan */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleCourtCompleted(
                                    proj.matchIndex,
                                    cNum,
                                    !isCourtCompleted
                                  )
                                }
                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition shadow-sm select-none cursor-pointer ${
                                  isCourtCompleted
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                                title={
                                  isCourtCompleted
                                    ? `Match ${proj.matchIndex} Lapangan ${cNum} sudah Selesai. Klik untuk batalkan.`
                                    : `Klik untuk menandai Match ${proj.matchIndex} Lapangan ${cNum} Selesai`
                                }
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isCourtCompleted ? "bg-emerald-600" : "bg-slate-400"
                                  }`}
                                ></span>
                                <span>{isCourtCompleted ? "✓ Selesai" : "⏳ Belum"}</span>
                              </button>
                            </td>

                            {/* Kolom Aksi */}
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRefereeModalMatch({
                                      matchIdx: proj.matchIndex,
                                      courtNum: cNum,
                                    })
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition shadow-sm active:scale-95 cursor-pointer ${
                                    courtResult
                                      ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                                      : "bg-white hover:bg-slate-100 text-slate-600 hover:text-amber-800 border-slate-300"
                                  }`}
                                  title={
                                    courtResult
                                      ? `Hasil tercatat: Wasit M${proj.matchIndex + 1} (${nextRefereePlayer?.name || "-"}). Klik untuk ubah.`
                                      : "Tandai tim kalah & pilih wasit untuk match berikutnya"
                                  }
                                >
                                  <span>⚖️</span>
                                  <span className="hidden sm:inline">{courtResult ? "Wasit ✓" : "Wasit"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingCourtMatch({
                                      matchIdx: proj.matchIndex,
                                      courtNum: cNum,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition shadow-sm active:scale-95 cursor-pointer"
                                  title={`Edit formasi Lapangan ${cNum} saja pada Match ${proj.matchIndex}`}
                                >
                                  <span>✏️</span>
                                  <span className="hidden sm:inline">Edit</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : activeTab === "spreadsheet" ? (
          <section className="bg-[#E7EEF4] border border-white/80 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
          {/* Header Tabel Spreadsheet */}
          <div className="p-4 sm:px-5 border-b border-slate-300/70 flex items-center justify-between gap-3 bg-[#DFE7EF]/80">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>📊 Rotasi Pemain</span>
            </h2>

            <div className="flex items-center gap-2 bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-300 text-xs">
              <span className="text-slate-600 font-medium">Total Cock:</span>
              <span className="font-mono font-bold text-emerald-700">
                {totalSessionShuttlecocks}
              </span>
            </div>
          </div>

          {/* Kontainer Tabel dengan Horizontal Scroll & Sticky Column */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#DFE7EF] border-b border-slate-300/70 text-slate-600">
                  {/* Sumbu Y Header: Sticky Left Column */}
                  <th className="sticky left-0 z-20 bg-[#DFE7EF] py-3 px-3 min-w-[280px] sm:min-w-[320px] border-r border-slate-300/70 shadow-sm">
                    <div className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                      Pemain &amp; Biaya
                    </div>
                  </th>

                  {/* Sumbu X Header: Kolom Match M1, M2, dst */}
                  {projections.map((proj) => {
                    const isCompleted = Boolean(completedMatches[proj.matchIndex]);
                    return (
                      <th
                        key={proj.matchIndex}
                        onClick={() => setSelectedMatchIdx(proj.matchIndex)}
                        className={`py-2 px-2 text-center border-r border-slate-300/70 min-w-[105px] cursor-pointer hover:bg-slate-200/60 transition-colors group select-none ${
                          isCompleted
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : ""
                        }`}
                        title="Klik untuk melihat detail atau edit formasi match ini"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-xs font-black font-mono flex items-center gap-1 ${
                                isCompleted
                                  ? "text-emerald-700"
                                  : "text-emerald-700 group-hover:text-emerald-800"
                              }`}
                            >
                              M{proj.matchIndex}
                              {proj.isOverridden && (
                                <span className="text-[10px] text-amber-500" title="Override aktif">
                                  ✏️
                                </span>
                              )}
                            </span>
                            {isCompleted && (
                              <span
                                className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
                                title="Match selesai (formasi terkunci)"
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-600">
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
                                  className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 w-full transition border shadow-xs ${theme.bgSubtleClass}`}
                                  title={`Shuttlecock ${theme.name} di Match ${proj.matchIndex}`}
                                >
                                  <span className="text-[9px] font-black font-mono text-white">
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
                                    className="w-6 bg-transparent text-right text-[10px] font-black focus:outline-none cursor-text text-white"
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Checkbox Tandai Match Selesai */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 w-full pt-1.5 border-t border-slate-300/70 flex flex-col items-center"
                          >
                            <label
                              className={`flex items-center justify-center gap-1.5 px-1.5 py-1 rounded-lg w-full cursor-pointer transition text-[10px] font-bold border select-none ${
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                                  : "bg-white/90 text-slate-600 border-slate-300 hover:border-slate-400"
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
                                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
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

              <tbody className="divide-y divide-slate-200/80 bg-white/80">
                {presentPlayers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={projectedMatchCount + 1}
                      className="py-12 text-center text-slate-400 italic text-sm"
                    >
                      Belum ada pemain yang berstatus hadir.{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("pemain")}
                        className="text-emerald-600 underline font-semibold hover:text-emerald-500 cursor-pointer not-italic"
                      >
                        Buka tab Kelola Pemain
                      </button>{" "}
                      untuk mencentang kehadiran.
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
                        className={`transition-colors ${
                          player.isAdmin ? "bg-[#E6E4F2]/50 hover:bg-[#E6E4F2]/80" : "hover:bg-slate-100/60"
                        }`}
                      >
                        {/* Kolom Sticky Pemain (Sumbu Y) */}
                        <td className={`sticky left-0 z-10 py-2 px-3 border-r border-slate-300/70 flex items-center justify-between gap-2 shadow-sm ${
                          player.isAdmin ? "bg-[#EAE8F5]" : "bg-[#F3F6F9]"
                        }`}>
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span
                              className={`w-5 h-5 rounded-full text-[10px] font-mono flex items-center justify-center font-bold shrink-0 ${
                                player.isAdmin
                                  ? "bg-[#DCD5EC] text-[#6B46C1] border border-[#C6B8E3]"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              #{player.arrivalOrder}
                            </span>
                            <div className="truncate">
                              <div className="flex items-center gap-1">
                                {player.isAdmin && (
                                  <span className="text-purple-700 shrink-0 text-xs" title="Admin / Host">
                                    👑
                                  </span>
                                )}
                                <input
                                  type="text"
                                  value={player.name}
                                  onChange={(e) =>
                                    handleUpdatePlayerName(player.id, e.target.value)
                                  }
                                  className="bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 focus:outline-none transition w-[110px] sm:w-[135px] truncate"
                                  title="Ubah nama pemain"
                                  placeholder="Nama pemain..."
                                />
                              </div>
                              {/* Rincian Biaya per Profile */}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {player.isAdmin ? (
                                  <span className="text-[10px] text-[#6B46C1] font-mono font-medium">
                                    Bebas Iuran
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setEditingFeePlayer(player)}
                                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-mono font-bold flex items-center gap-1 transition"
                                      title="Klik untuk ubah biaya / beri diskon"
                                    >
                                      <span>Rp {fee.toLocaleString("id-ID")}</span>
                                      <span className="text-[10px] text-slate-400 hover:text-slate-600">✏️</span>
                                    </button>
                                    {isCustom && (
                                      <span
                                        className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold cursor-pointer"
                                        onClick={() => setEditingFeePlayer(player)}
                                        title="Biaya disesuaikan manual"
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
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCD5EC] text-[#6B46C1] border border-[#C6B8E3] font-mono">
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
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border focus:outline-none cursor-pointer transition ${
                                  paymentStatuses[player.id] === "QRIS"
                                    ? "bg-sky-100 text-sky-800 border-sky-300"
                                    : paymentStatuses[player.id] === "Cash"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                                }`}
                                title="Status Pembayaran"
                              >
                                <option value="" className="bg-white text-slate-500 font-normal">
                                  - Belum -
                                </option>
                                <option value="QRIS" className="bg-white text-sky-800 font-bold">
                                  QRIS
                                </option>
                                <option value="Cash" className="bg-white text-emerald-800 font-bold">
                                  Cash
                                </option>
                              </select>
                            )}

                            {/* Live Level Editor Dropdown - Khusus Non-Admin */}
                            {!player.isAdmin && (
                              <select
                                value={player.level ?? 1}
                                onChange={(e) =>
                                  handleUpdatePlayerLevel(
                                    player.id,
                                    Number(e.target.value)
                                  )
                                }
                                className={`px-1 py-0.5 rounded text-[10px] font-bold font-mono border focus:outline-none cursor-pointer transition ${
                                  (player.level ?? 0) >= 4
                                    ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                                    : player.level === 3
                                    ? "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200"
                                    : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                                }`}
                                title="Ubah level pemain"
                              >
                                <option value={5} className="bg-white text-slate-800 font-bold">L5</option>
                                <option value={4} className="bg-white text-slate-800 font-bold">L4</option>
                                <option value={3} className="bg-white text-slate-800 font-bold">L3</option>
                                <option value={2} className="bg-white text-slate-800 font-bold">L2</option>
                                <option value={1} className="bg-white text-slate-800 font-bold">L1</option>
                              </select>
                            )}

                            {/* Total Main Badge */}
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700"
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
                                className={`py-2 px-2 text-center border-r border-slate-300/70 cursor-pointer hover:bg-slate-200/50 transition-colors ${
                                  isCompleted ? "bg-emerald-500/10" : ""
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
                              className={`py-2 px-2 text-center border-r border-slate-300/70 cursor-pointer hover:bg-slate-200/50 transition-colors ${
                                isCompleted ? "bg-emerald-500/10" : ""
                              }`}
                            >
                              <span className="text-slate-400 select-none font-bold text-xs">
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
        </section>
        ) : (
          <section className="bg-[#E7EEF4] border border-white/80 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-300/70 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>👥 Kelola Pemain ({players.length} Terdaftar)</span>
              </h2>
            </div>

            {/* Form Tambah Pemain Baru */}
            <form
              onSubmit={handleAddPlayer}
              className="bg-[#DFE7EF]/80 border border-slate-300/70 rounded-xl p-4 flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Pemain
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Taufik Hidayat"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="w-28">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Level (1 - 5)
                </label>
                <select
                  value={newPlayerLevel}
                  onChange={(e) => setNewPlayerLevel(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <label
                  htmlFor="new-present"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Langsung Hadir
                </label>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                + Tambah Pemain
              </button>
            </form>

            {/* Tabel Daftar Pemain Terdaftar */}
            <div className="overflow-x-auto rounded-xl border border-slate-300/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#DFE7EF] text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-300/70">
                  <tr>
                    <th className="py-2.5 px-4 w-16 text-center">Hadir</th>
                    <th className="py-2.5 px-4 w-20 text-center">Urutan</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Nama Pemain (Live Edit)</th>
                    <th className="py-2.5 px-4 w-32 text-center">Level</th>
                    <th className="py-2.5 px-4 w-24 text-center">Main</th>
                    <th className="py-2.5 px-4 w-36 text-right">Bayar</th>
                    <th className="py-2.5 px-4 w-24 text-right">
                      <button
                        type="button"
                        onClick={handleDeleteAllPlayers}
                        disabled={players.filter((p) => !p.isAdmin).length === 0}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer normal-case inline-flex items-center gap-1"
                        title="Hapus semua pemain kecuali Host/Admin"
                      >
                        <span>🗑️</span>
                        <span>Hapus</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white/80">
                  {sortedPlayers.map((player) => {
                    const pStats = playerStatsMap.get(player.id);
                    return (
                      <tr
                        key={player.id}
                        className={`hover:bg-slate-100/60 transition ${
                          player.isAdmin
                            ? "bg-[#E6E4F2]/50 border-l-2 border-purple-500"
                            : player.isPresent
                            ? "bg-emerald-50/40"
                            : "opacity-60"
                        }`}
                      >
                        <td className="py-2 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={player.isPresent}
                            onChange={() => handleTogglePresent(player.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                          {player.isPresent ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold ${
                                player.isAdmin
                                  ? "bg-[#DCD5EC] text-[#6B46C1] border border-[#C6B8E3]"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              #{player.arrivalOrder}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            {player.isAdmin && (
                              <span className="px-1.5 py-0.2 rounded bg-[#DCD5EC] text-[#6B46C1] border border-[#C6B8E3] text-[10px] font-black shrink-0">
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
                                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 hover:border-slate-400 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none transition shadow-inner"
                                placeholder="Nama pemain..."
                                title="Klik untuk mengedit nama pemain langsung"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          {player.isAdmin ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#DCD5EC] text-[#6B46C1] border border-[#C6B8E3] font-mono">
                              👑 Host
                            </span>
                          ) : (
                            <select
                              value={player.level ?? 1}
                              onChange={(e) =>
                                handleUpdatePlayerLevel(
                                  player.id,
                                  Number(e.target.value)
                                )
                              }
                              className="bg-white border border-slate-300 hover:border-emerald-500 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer transition"
                              title="Ubah level pemain (otomatis menghitung ulang match berikutnya secara real-time)"
                            >
                              <option value={5}>Level 5 (Mahir)</option>
                              <option value={4}>Level 4 (Atas)</option>
                              <option value={3}>Level 3 (Menengah)</option>
                              <option value={2}>Level 2 (Dasar)</option>
                              <option value={1}>Level 1 (Pemula)</option>
                            </select>
                          )}
                        </td>
                        <td className="py-2 px-4 text-center font-mono text-slate-600">
                          {player.isPresent ? (
                            <span
                              className="font-bold text-slate-700"
                              title={`Bermain ${pStats?.matchesPlayed || 0} match (${pStats?.shuttlecockCount || 0} kok)`}
                            >
                              {pStats?.matchesPlayed || 0}m
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold">
                          {player.isAdmin ? (
                            <div className="flex flex-col items-end">
                              <span className="text-purple-700 text-xs font-black">
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
                                  className="text-emerald-700 hover:text-emerald-800 text-xs flex items-center gap-1 transition"
                                  title="Klik untuk ubah biaya manual / beri diskon"
                                >
                                  <span>Rp {pStats?.fee.toLocaleString("id-ID")}</span>
                                  <span className="text-[10px] text-slate-400 hover:text-slate-600">✏️</span>
                                </button>
                                {pStats?.isCustom && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
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
                            <span className="text-slate-400 text-xs select-none" title="Admin tidak dapat dihapus">
                              🔒
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDeletePlayer(player.id)}
                              className="text-slate-400 hover:text-rose-600 transition text-xs p-1"
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
          MODAL EDIT SINGLE COURT (EDIT FORMASI SATU LAPANGAN)
      ====================================================================== */}
      {editingCourtMatch && (
        <EditSingleCourtModal
          isOpen={editingCourtMatch !== null}
          onClose={() => setEditingCourtMatch(null)}
          matchIndex={editingCourtMatch.matchIdx}
          courtNum={editingCourtMatch.courtNum}
          courtCount={courtCount}
          projection={
            projections.find((p) => p.matchIndex === editingCourtMatch.matchIdx) || null
          }
          activePlayers={presentPlayers}
          playerMap={playerMap}
          isCourtCompleted={Boolean(
            completedCourts[`${editingCourtMatch.matchIdx}_c${editingCourtMatch.courtNum}`]
          )}
          isCourtOverridden={Boolean(
            overrides[editingCourtMatch.matchIdx]?.overriddenCourts?.[editingCourtMatch.courtNum]
          )}
          onSave={handleSaveCourtOverride}
          onReset={handleResetCourtOverride}
        />
      )}

      {/* =====================================================================
          MODAL PENUNJUKAN WASIT & CATAT TIM KALAH
      ====================================================================== */}
      {refereeModalMatch && (
        <MatchRefereeModal
          isOpen={refereeModalMatch !== null}
          onClose={() => setRefereeModalMatch(null)}
          matchIndex={refereeModalMatch.matchIdx}
          courtNum={refereeModalMatch.courtNum}
          courtMatch={
            (() => {
              const proj = projections.find(
                (p) => p.matchIndex === refereeModalMatch.matchIdx
              );
              if (!proj) return null;
              return (
                proj.courts?.[refereeModalMatch.courtNum - 1] ||
                (refereeModalMatch.courtNum === 1
                  ? proj.court1
                  : refereeModalMatch.courtNum === 2
                  ? proj.court2
                  : null)
              );
            })()
          }
          playerMap={playerMap}
          allPlayers={players}
          currentResult={
            courtResults[`${refereeModalMatch.matchIdx}_c${refereeModalMatch.courtNum}`] || null
          }
          isCourtCompleted={Boolean(
            completedCourts[`${refereeModalMatch.matchIdx}_c${refereeModalMatch.courtNum}`]
          )}
          refereeStats={refereeStats}
          onSaveResult={handleSaveCourtResult}
          onResetResult={handleResetCourtResult}
        />
      )}

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

      {/* =====================================================================
          MODAL LAPORAN KEUANGAN, PENGELUARAN & KEUNTUNGAN BERSIH
      ====================================================================== */}
      <FinanceModal
        isOpen={isFinanceModalOpen}
        onClose={() => setIsFinanceModalOpen(false)}
        totalKas={totalKas}
        totalPemasukanTerbayar={totalPemasukanTerbayar}
        courtPrice={courtPrice}
        setCourtPrice={setCourtPrice}
        courtCount={courtCount}
        shuttlecockPrice={shuttlecockPrice}
        setShuttlecockPrice={setShuttlecockPrice}
        totalSessionShuttlecocks={totalSessionShuttlecocks}
        presentPlayers={presentPlayers}
        paymentStatuses={paymentStatuses}
        playerStatsMap={playerStatsMap}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
        qrisPaidCount={stats.qrisPaidCount}
        cashPaidCount={stats.cashPaidCount}
        totalPaidCount={stats.totalPaidCount}
        regularPresent={stats.regularPresent}
      />
    </div>
  );
}
