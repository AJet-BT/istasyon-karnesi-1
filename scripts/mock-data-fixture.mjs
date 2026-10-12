export const MOCK_PERIODS = [
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
];

export const MOCK_STATIONS = [
  { code: "ADB", baseFlights: 385, passengersPerFlight: 168, baseOtp: 91, baseDamaged: 0.0034, baseLost: 0.0007, baseComp: 0.95, profile: "city" },
  { code: "AYT", baseFlights: 365, passengersPerFlight: 176, baseOtp: 90, baseDamaged: 0.0042, baseLost: 0.0008, baseComp: 1.08, profile: "tourism" },
  { code: "BJV", baseFlights: 205, passengersPerFlight: 158, baseOtp: 92, baseDamaged: 0.0040, baseLost: 0.0006, baseComp: 1.12, profile: "tourism" },
  { code: "COV", baseFlights: 215, passengersPerFlight: 164, baseOtp: 91, baseDamaged: 0.0045, baseLost: 0.0009, baseComp: 0.92, profile: "city" },
  { code: "DLM", baseFlights: 155, passengersPerFlight: 160, baseOtp: 93, baseDamaged: 0.0037, baseLost: 0.0005, baseComp: 0.82, profile: "tourism" },
  { code: "ESB", baseFlights: 2260, passengersPerFlight: 166, baseOtp: 90, baseDamaged: 0.0031, baseLost: 0.0010, baseComp: 0.74, profile: "hub" },
  { code: "SAW", baseFlights: 3960, passengersPerFlight: 171, baseOtp: 89, baseDamaged: 0.0036, baseLost: 0.0017, baseComp: 1.62, profile: "hub" },
];

const TOURISM_FACTORS = [1.52, 1.58, 1.30, 0.88, 0.62, 0.50, 0.46, 0.49, 0.62, 0.80, 1.04, 1.40];
const CITY_FACTORS = [1.07, 1.05, 1.02, 1.00, 0.98, 0.94, 0.91, 0.93, 0.97, 1.00, 1.03, 1.06];
const HUB_FACTORS = [1.06, 1.05, 1.03, 1.01, 1.00, 0.97, 0.94, 0.96, 1.00, 1.02, 1.04, 1.07];
const QUALITY_SHIFT = [-3.0, -3.8, -1.4, 0.4, -0.3, -1.7, -5.1, -2.4, 0.8, 1.8, 2.3, 0.6];
const SEASONAL_RISK = [1.00, 1.12, 0.66, 0.25, 0.12, 0.35, 0.95, 0.48, 0.10, -0.08, -0.16, 0.22];

const round = (value, digits = 0) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mockFileName(period) {
  return `AJet_TGS_${period}_test_mock.xlsx`;
}

export function buildMockRows() {
  return MOCK_PERIODS.flatMap((period, periodIndex) => MOCK_STATIONS.map((station, stationIndex) => {
    const factors = station.profile === "tourism" ? TOURISM_FACTORS : station.profile === "hub" ? HUB_FACTORS : CITY_FACTORS;
    const flightWave = 1 + ((stationIndex + periodIndex) % 3 - 1) * 0.012;
    const flights = Math.round(station.baseFlights * factors[periodIndex] * flightWave);
    const loadFactor = 0.93 + (periodIndex % 4) * 0.012 + (station.profile === "tourism" && periodIndex < 3 ? 0.035 : 0);
    const passengers = Math.round(flights * station.passengersPerFlight * loadFactor);
    const peakPenalty = station.profile === "tourism" && periodIndex < 3 ? -1.2 : 0;
    const hubWinterPenalty = station.profile === "hub" && periodIndex === 6 ? -1.4 : 0;
    const otp = clamp(station.baseOtp + QUALITY_SHIFT[periodIndex] + peakPenalty + hubWinterPenalty + (stationIndex % 3 - 1) * 0.35, 76, 98);
    const ota = clamp(otp + [0.8, -0.4, 0.5, 0.2, -0.6, 0.4, -0.5][stationIndex] + (periodIndex % 2 ? 0.25 : -0.15), 76, 98);
    const pressure = Math.max(0, 92 - otp);
    const delayMinutes = Math.round(flights * (0.09 + pressure * 0.018 + Math.max(SEASONAL_RISK[periodIndex], 0) * 0.035));
    const documentErrorRate = clamp(0.00035 + stationIndex * 0.000045 + pressure * 0.000035, 0.0002, 0.0035);
    const damagedBaggageRate = clamp(station.baseDamaged + SEASONAL_RISK[periodIndex] * 0.00072 + pressure * 0.000035, 0.0012, 0.0095);
    const lostBaggageRate = clamp(station.baseLost + SEASONAL_RISK[periodIndex] * 0.00024 + pressure * 0.000018, 0.0001, 0.0045);
    const safetyIrregularityRate = clamp(0.00025 + stationIndex * 0.000045 + pressure * 0.000025, 0.0001, 0.004);
    const nonSafetyIrregularityRate = clamp(0.00045 + (6 - stationIndex) * 0.000035 + pressure * 0.00002, 0.0001, 0.004);
    const safetyReportingCount = Math.max(1, Math.round(flights / 420 + (periodIndex + stationIndex) % 3));
    const complaintResponseDays = clamp(station.baseComp + pressure * 0.075 + Math.max(SEASONAL_RISK[periodIndex], 0) * 0.16, 0.35, 3.8);
    return {
      period,
      STATION_CODE: station.code,
      FLIGHT: flights,
      DELAY: delayMinutes,
      DOC: round(documentErrorRate, 6),
      DAM: round(damagedBaggageRate, 6),
      LOST: round(lostBaggageRate, 6),
      IRSAFE: round(safetyIrregularityRate, 6),
      NIRSAFE: round(nonSafetyIrregularityRate, 6),
      SAFE: safetyReportingCount,
      OTP: round(otp / 100, 4),
      OTA: round(ota / 100, 4),
      COMP: round(complaintResponseDays, 2),
      PASS: passengers,
    };
  }));
}

export const MOCK_ROWS = buildMockRows();
