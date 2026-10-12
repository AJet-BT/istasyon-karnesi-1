import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cities, countries, portMappingHistory, ports, regions, stationPerformance } from "@/db/schema";
import { Actor, audit, normalizeCountryCode, PlatformError, requireAdmin } from "@/lib/server/platform";

function required(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new PlatformError(`${label} zorunludur.`);
  return result;
}

function iata(value: unknown) {
  const code = required(value, "IATA kodu").toLocaleUpperCase("tr-TR");
  if (!/^[A-Z]{3}$/.test(code)) throw new PlatformError("IATA kodu üç harften oluşmalıdır.");
  return code;
}

async function masterRow(id: string) {
  return (await getDb().select({
    id: ports.id, stationCode: ports.stationCode, iataCode: ports.iataCode,
    airportName: ports.airportName, shortName: ports.shortName, displayCity: ports.displayCity,
    cityId: cities.id, cityName: cities.name, countryId: countries.id, countryCode: countries.iso2Code,
    countryName: countries.nameTr, regionId: regions.id, regionCode: regions.code, regionName: regions.name,
    activeStatus: ports.activeStatus, createdAt: ports.createdAt, updatedAt: ports.updatedAt,
  }).from(ports)
    .leftJoin(cities, eq(ports.cityId, cities.id))
    .leftJoin(countries, eq(ports.countryId, countries.id))
    .leftJoin(regions, eq(ports.regionId, regions.id))
    .where(eq(ports.id, id)).limit(1))[0];
}

async function geography(cityId: string, countryId: string, regionId: string) {
  const db = getDb();
  const city = (await db.select().from(cities).where(eq(cities.id, cityId)).limit(1))[0];
  const country = (await db.select().from(countries).where(eq(countries.id, countryId)).limit(1))[0];
  const region = (await db.select().from(regions).where(eq(regions.id, regionId)).limit(1))[0];
  if (!city || !country || !region || city.countryId !== country.id) throw new PlatformError("Şehir, ülke veya bölge seçimi geçersiz.");
  if (normalizeCountryCode(country.iso2Code) !== "TR") throw new PlatformError("Bu sürümde yalnızca merkezi Türkiye kaydı kullanılabilir.");
  return { city, country, region };
}

async function addHistory(actor: Actor, values: { portId?: string | null; stationCode: string; action: string; previousValue?: unknown; newValue?: unknown }) {
  await getDb().insert(portMappingHistory).values({
    id: crypto.randomUUID(), portId: values.portId ?? null, stationCode: values.stationCode,
    action: values.action, previousValue: values.previousValue === undefined ? null : JSON.stringify(values.previousValue),
    newValue: values.newValue === undefined ? null : JSON.stringify(values.newValue),
    changedBy: actor.id, createdAt: Date.now(),
  });
}

export async function getPortMaster(actor: Actor) {
  requireAdmin(actor);
  const db = getDb();
  const portRows = await db.select({
    id: ports.id, stationCode: ports.stationCode, iataCode: ports.iataCode,
    airportName: ports.airportName, shortName: ports.shortName, displayCity: ports.displayCity,
    cityId: cities.id, cityName: cities.name, cityDisplayName: cities.displayName,
    countryId: countries.id, countryCode: countries.iso2Code, countryName: countries.nameTr,
    regionId: regions.id, regionCode: regions.code, regionName: regions.name,
    activeStatus: ports.activeStatus, createdAt: ports.createdAt, updatedAt: ports.updatedAt,
  }).from(ports)
    .leftJoin(cities, eq(ports.cityId, cities.id))
    .leftJoin(countries, eq(ports.countryId, countries.id))
    .leftJoin(regions, eq(ports.regionId, regions.id))
    .orderBy(asc(ports.stationCode));
  const regionRows = await db.select().from(regions).orderBy(asc(regions.name));
  const countryRows = await db.select().from(countries).orderBy(asc(countries.nameTr));
  const cityRows = await db.select().from(cities).orderBy(asc(cities.name));
  const unresolved = await db.select({
    stationCode: stationPerformance.stationCode,
    count: sql<number>`count(*)`,
  }).from(stationPerformance)
    .where(and(eq(stationPerformance.tenantId, actor.tenantId), eq(stationPerformance.locationMappingStatus, "unresolved")))
    .groupBy(stationPerformance.stationCode).orderBy(asc(stationPerformance.stationCode));
  const history = await db.select().from(portMappingHistory).orderBy(desc(portMappingHistory.createdAt)).limit(100);
  return { ports: portRows, regions: regionRows, countries: countryRows, cities: cityRows, unresolved, history };
}

export async function createPort(actor: Actor, payload: Record<string, unknown>) {
  requireAdmin(actor);
  const db = getDb();
  const code = iata(payload.iataCode ?? payload.stationCode);
  const airportName = required(payload.airportName, "Havalimanı adı");
  const shortName = required(payload.shortName, "Kısa ad");
  const cityId = required(payload.cityId, "Şehir");
  const countryId = required(payload.countryId, "Ülke");
  const regionId = required(payload.regionId, "Bölge");
  const location = await geography(cityId, countryId, regionId);
  if ((await db.select({ id: ports.id }).from(ports).where(eq(ports.stationCode, code)).limit(1)).length) {
    throw new PlatformError("Bu IATA koduyla kayıtlı bir havalimanı bulunuyor.", 409);
  }
  const timestamp = Date.now();
  const id = `port-${code.toLocaleLowerCase("tr-TR")}-${crypto.randomUUID().slice(0, 8)}`;
  const displayCity = String(payload.displayCity ?? location.city.displayName).trim() || location.city.displayName;
  await db.insert(ports).values({
    id, stationCode: code, iataCode: code, stationName: shortName, airportName, shortName,
    cityId, countryId, regionId, displayCity, cityName: location.city.name,
    countryCode: location.country.iso2Code, countryName: location.country.nameTr,
    regionCode: location.region.code, regionName: location.region.name,
    activeStatus: String(payload.activeStatus ?? "active") === "inactive" ? "inactive" : "active",
    createdAt: timestamp, updatedAt: timestamp,
  });
  await db.update(stationPerformance).set({ portId: id, locationMappingStatus: "resolved", validationStatus: "valid" })
    .where(and(eq(stationPerformance.tenantId, actor.tenantId), eq(stationPerformance.stationCode, code), eq(stationPerformance.locationMappingStatus, "unresolved")));
  const created = await masterRow(id);
  await addHistory(actor, { portId: id, stationCode: code, action: "port.create", newValue: created });
  await audit(actor, "port.create", "port", id, undefined, created);
  return created;
}

export async function updatePort(actor: Actor, id: string, payload: Record<string, unknown>) {
  requireAdmin(actor);
  const db = getDb();
  const previous = await masterRow(id);
  if (!previous) throw new PlatformError("Havalimanı kaydı bulunamadı.", 404);
  const code = payload.iataCode === undefined ? previous.stationCode : iata(payload.iataCode);
  if (code !== previous.stationCode && (await db.select({ id: ports.id }).from(ports).where(eq(ports.stationCode, code)).limit(1)).length) {
    throw new PlatformError("Bu IATA koduyla kayıtlı bir havalimanı bulunuyor.", 409);
  }
  const cityId = String(payload.cityId ?? previous.cityId);
  const countryId = String(payload.countryId ?? previous.countryId);
  const regionId = String(payload.regionId ?? previous.regionId);
  const location = await geography(cityId, countryId, regionId);
  const timestamp = Date.now();
  await db.update(ports).set({
    stationCode: code, iataCode: code,
    airportName: payload.airportName === undefined ? previous.airportName : required(payload.airportName, "Havalimanı adı"),
    shortName: payload.shortName === undefined ? previous.shortName : required(payload.shortName, "Kısa ad"),
    stationName: payload.shortName === undefined ? previous.shortName ?? previous.stationCode : required(payload.shortName, "Kısa ad"),
    cityId, countryId, regionId,
    displayCity: payload.displayCity === undefined ? previous.displayCity : String(payload.displayCity).trim() || location.city.displayName,
    cityName: location.city.name, countryCode: location.country.iso2Code, countryName: location.country.nameTr,
    regionCode: location.region.code, regionName: location.region.name,
    activeStatus: payload.activeStatus === undefined ? previous.activeStatus : String(payload.activeStatus) === "inactive" ? "inactive" : "active",
    updatedAt: timestamp,
  }).where(eq(ports.id, id));
  const updated = await masterRow(id);
  await addHistory(actor, { portId: id, stationCode: code, action: "port.update", previousValue: previous, newValue: updated });
  await audit(actor, "port.update", "port", id, previous, updated);
  return updated;
}

export async function resolvePortMapping(actor: Actor, payload: Record<string, unknown>) {
  requireAdmin(actor);
  const db = getDb();
  const stationCode = iata(payload.stationCode);
  const action = String(payload.action ?? "review");
  if (!["map", "review", "exclude"].includes(action)) throw new PlatformError("Geçersiz eşleştirme işlemi.");
  let portId: string | null = null;
  let nextStatus = "unresolved";
  let validationStatus = "warning";
  if (action === "map") {
    portId = required(payload.portId, "Havalimanı");
    const port = await masterRow(portId);
    if (!port || port.activeStatus !== "active") throw new PlatformError("Aktif havalimanı kaydı bulunamadı.", 404);
    nextStatus = "resolved";
    validationStatus = "valid";
  } else if (action === "exclude") {
    nextStatus = "excluded";
  }
  await db.update(stationPerformance).set({ portId, locationMappingStatus: nextStatus, validationStatus })
    .where(and(eq(stationPerformance.tenantId, actor.tenantId), eq(stationPerformance.stationCode, stationCode)));
  const changed = { stationCode, action, portId, locationMappingStatus: nextStatus };
  await addHistory(actor, { portId, stationCode, action: `mapping.${action}`, newValue: changed });
  await audit(actor, `port.mapping.${action}`, "station_code", stationCode, undefined, changed);
  return changed;
}
