import { clsx } from "clsx";
/**
 * Merge class names with clsx.
 * Keeps a single helper so every component imports from the same place;
 * if we later add tailwind-merge we swap only this file.
 */
export function cn(...inputs) {
    return clsx(inputs);
}

/**
 * Resolves the authoritative IANA timezone identifier for a resource reservation.
 * Priority order:
 * 1. Explicit resource-level timezone (resource.timezone or resource.location.timezone)
 * 2. Institutional campus default configured via environment (NEXT_PUBLIC_DEFAULT_TIMEZONE)
 * 3. Client browser runtime timezone via Intl.DateTimeFormat
 * 4. Authoritative fallback: "UTC"
 *
 * @param {Object} [resource] - Target campus facility or resource object.
 * @returns {string} Valid IANA timezone identifier.
 */
export function resolveReservationTimezone(resource) {
    // 1. Explicit resource or location timezone
    if (resource?.timezone && typeof resource.timezone === "string") {
        return resource.timezone.trim();
    }
    if (resource?.location?.timezone && typeof resource.location.timezone === "string") {
        return resource.location.timezone.trim();
    }

    // 2. Institutional campus default from environment
    if (
        typeof process !== "undefined" &&
        process.env?.NEXT_PUBLIC_DEFAULT_TIMEZONE &&
        typeof process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE === "string"
    ) {
        return process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE.trim();
    }

    // 3. Client browser environment timezone
    try {
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (clientTz && typeof clientTz === "string" && (clientTz.includes("/") || clientTz === "UTC" || clientTz === "GMT")) {
            return clientTz;
        }
    } catch {
        // Intl resolution failed
    }

    // 4. Authoritative fallback
    return "UTC";
}

/**
 * Converts a local calendar date ("YYYY-MM-DD") and time ("HH:mm") in a specific timezone
 * into an authoritative UTC Date object.
 *
 * @param {string} dateStr - Date formatted as "YYYY-MM-DD".
 * @param {string} timeStr - Time formatted as "HH:mm".
 * @param {string} [tz="UTC"] - IANA timezone identifier.
 * @returns {Date} Authoritative UTC Date object.
 */
export function localToUtc(dateStr, timeStr, tz = "UTC") {
    try {
        const [y, m, d] = dateStr.split("-").map(Number);
        const [h, min] = timeStr.split(":").map(Number);
        const naive = new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        });
        const parts = formatter.formatToParts(naive);
        const get = (t) => parseInt(parts.find((p) => p.type === t)?.value || "0", 10);
        const tzAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"), get("second"));
        const offsetMs = tzAsUtc - naive.getTime();
        return new Date(naive.getTime() - offsetMs);
    } catch {
        return new Date(`${dateStr}T${timeStr}:00.000Z`);
    }
}

/**
 * Given a UTC Date object or ISO string, extracts the local date ("YYYY-MM-DD")
 * and time ("HH:mm") in the specified timezone.
 *
 * @param {Date|string} utcDateOrIso - UTC Date object or ISO timestamp.
 * @param {string} [tz="UTC"] - IANA timezone identifier.
 * @returns {{ date: string, time: string }} Local date and time strings.
 */
export function utcToLocalParts(utcDateOrIso, tz = "UTC") {
    try {
        const d = typeof utcDateOrIso === "string" ? new Date(utcDateOrIso) : utcDateOrIso;
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hour12: false,
        });
        const parts = formatter.formatToParts(d);
        const get = (t) => parts.find((p) => p.type === t)?.value || "00";
        let hour = get("hour");
        if (hour === "24") hour = "00";
        return {
            date: `${get("year")}-${get("month")}-${get("day")}`,
            time: `${hour}:${get("minute")}`,
        };
    } catch {
        const d = new Date(utcDateOrIso);
        return {
            date: d.toISOString().slice(0, 10),
            time: d.toISOString().slice(11, 16),
        };
    }
}

