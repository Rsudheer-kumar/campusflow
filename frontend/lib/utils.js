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
