/**
 * CampusFlow Web - API Client
 * Centralized, typed API abstraction connecting the Next.js frontend to the Express backend.
 * Provides resilient credential handling, authorization header injection,
 * and transparent 401 refresh token retry.
 */
export class ApiError extends Error {
    code;
    status;
    details;
    constructor(message, code = "UNKNOWN_ERROR", status = 500, details) {
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
// ─── Token Management ─────────────────────────────────────────────────────────
let memoryAccessToken = null;
export function getStoredAccessToken() {
    if (memoryAccessToken)
        return memoryAccessToken;
    if (typeof window !== "undefined") {
        return localStorage.getItem("cf_access_token");
    }
    return null;
}
export function setStoredAccessToken(token) {
    memoryAccessToken = token;
    if (typeof window !== "undefined") {
        if (token) {
            localStorage.setItem("cf_access_token", token);
        }
        else {
            localStorage.removeItem("cf_access_token");
        }
    }
}
// ─── HTTP Core Transport ───────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
async function request(endpoint, options = {}, isRetry = false) {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }
    const token = getStoredAccessToken();
    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const fetchOptions = {
        ...options,
        headers,
        credentials: "include", // Transmit cf_refresh cookie
    };
    let res;
    try {
        res = await fetch(url, fetchOptions);
    }
    catch (netErr) {
        throw new ApiError("Unable to connect to CampusFlow server. Please check your network or server status.", "NETWORK_ERROR", 0);
    }
    // Handle 401 Unauthorized transparent token refresh
    if (res.status === 401 && !isRetry && !endpoint.includes("/auth/")) {
        try {
            const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
                method: "POST",
                credentials: "include",
            });
            if (refreshRes.ok) {
                const refreshData = (await refreshRes.json());
                if (refreshData?.data?.accessToken) {
                    setStoredAccessToken(refreshData.data.accessToken);
                    return request(endpoint, options, true);
                }
            }
            else {
                // Refresh token failed or expired
                setStoredAccessToken(null);
            }
        }
        catch {
            setStoredAccessToken(null);
        }
    }
    let body;
    try {
        body = await res.json();
    }
    catch {
        body = null;
    }
    if (!res.ok) {
        const errorBody = body;
        const errorCode = errorBody?.error?.code || `HTTP_${res.status}`;
        const errorMessage = errorBody?.error?.message || res.statusText || "An unexpected error occurred";
        const details = errorBody?.error?.details;
        throw new ApiError(errorMessage, errorCode, res.status, details);
    }
    const successBody = body;
    return successBody.data;
}
// ─── API Client Methods ─────────────────────────────────────────────────────────
export const api = {
    // Authentication
    auth: {
        login: async (email, password) => {
            const data = await request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            setStoredAccessToken(data.accessToken);
            return data;
        },
        refresh: async () => {
            const data = await request("/auth/refresh", {
                method: "POST",
            });
            setStoredAccessToken(data.accessToken);
            return data;
        },
        logout: async () => {
            try {
                await request("/auth/logout", { method: "POST" });
            }
            finally {
                setStoredAccessToken(null);
            }
        },
        getProfile: async () => {
            return request("/auth/profile");
        },
        updateProfile: async (payload) => {
            return request("/auth/profile", {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        },
    },
    // Resources
    resources: {
        /**
         * @typedef {Object} ResourceListParams
         * @property {string} [search] - Substring query across name, code, or building.
         * @property {string} [building] - Filter facilities by building name.
         * @property {string} [status] - Filter by operational status (e.g. 'ACTIVE').
         * @property {string} [resourceType] - Filter by category or resource type ID.
         * @property {number} [page=1] - 1-based page index.
         * @property {number} [limit=50] - Number of items per page.
         */

        /**
         * Fetches a paginated list of campus facilities.
         *
         * @param {ResourceListParams} [params] - Query filters and pagination.
         * @returns {Promise<{ resources: Array<Object>, total: number, page: number, totalPages: number }>}
         */
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.search)
                searchParams.set("search", params.search);
            if (params.building)
                searchParams.set("building", params.building);
            if (params.status)
                searchParams.set("status", params.status);
            if (params.resourceType)
                searchParams.set("resourceType", params.resourceType);
            if (params.page)
                searchParams.set("page", String(params.page));
            if (params.limit)
                searchParams.set("limit", String(params.limit));
            const query = searchParams.toString();
            return request(`/resources${query ? `?${query}` : ""}`);
        },
        getById: async (id) => {
            return request(`/resources/${id}`);
        },
        create: async (payload) => {
            return request("/resources", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        update: async (id, payload) => {
            return request(`/resources/${id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        },
        archive: async (id) => {
            return request(`/resources/${id}`, {
                method: "DELETE",
            });
        },
        updateStatus: async (id, payload) => {
            return request(`/resources/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        },
        getTypes: async () => {
            return request("/resources/types");
        },
        bulkImport: async (csv) => {
            return request("/resources/bulk-import", {
                method: "POST",
                body: JSON.stringify({ csv }),
            });
        },
        addPhoto: async (id, photo) => {
            return request(`/resources/${id}/photos`, {
                method: "POST",
                body: JSON.stringify(photo),
            });
        },
        deletePhoto: async (id, photoId) => {
            return request(`/resources/${id}/photos/${photoId}`, {
                method: "DELETE",
            });
        },
        setPrimaryPhoto: async (id, photoId) => {
            return request(`/resources/${id}/photos/${photoId}/primary`, {
                method: "PUT",
            });
        },
    },
    // Timetable Sessions (Phase 3.1)
    timetables: {
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.resourceId)
                searchParams.set("resourceId", params.resourceId);
            if (params.academicTerm)
                searchParams.set("academicTerm", params.academicTerm);
            // Prefer explicit startAt/endAt; fall back to legacy startDate/endDate aliases
            const sa = params.startAt ?? params.startDate;
            const ea = params.endAt ?? params.endDate;
            if (sa)
                searchParams.set("startAt", sa);
            if (ea)
                searchParams.set("endAt", ea);
            if (params.page)
                searchParams.set("page", String(params.page));
            if (params.limit)
                searchParams.set("limit", String(params.limit));
            const query = searchParams.toString();
            return request(`/timetables${query ? `?${query}` : ""}`);
        },
    },
    // Bookings & Availability
    bookings: {
        /**
         * @typedef {Object} BookingListParams
         * @property {string} [status] - Filter by booking status ('CONFIRMED', 'PENDING', 'CHECKED_IN', etc.).
         * @property {string} [resourceId] - Filter by specific facility/room ID.
         * @property {string} [startAt] - Start ISO date string for range filtering.
         * @property {string} [endAt] - End ISO date string for range filtering.
         * @property {number} [page=1] - 1-based page number.
         * @property {number} [limit=50] - Number of records per page.
         */

        /**
         * Retrieves a list of user or facility reservations.
         *
         * @param {BookingListParams} [params] - Query options.
         * @returns {Promise<{ bookings: Array<Object>, items: Array<Object>, total: number, page: number, limit: number, totalPages: number }>}
         */
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.status)
                searchParams.set("status", params.status);
            if (params.resourceId)
                searchParams.set("resourceId", params.resourceId);
            if (params.startAt)
                searchParams.set("startAt", params.startAt);
            if (params.endAt)
                searchParams.set("endAt", params.endAt);
            if (params.page)
                searchParams.set("page", String(params.page));
            if (params.limit)
                searchParams.set("limit", String(params.limit));
            const query = searchParams.toString();
            const raw = await request(`/bookings${query ? `?${query}` : ""}`);
            const list = raw?.bookings || raw?.items || [];
            return {
                bookings: list,
                items: list,
                total: raw?.total ?? list.length,
                page: raw?.page ?? 1,
                limit: raw?.limit ?? 50,
                totalPages: raw?.totalPages ?? 1,
            };
        },
        getById: async (id) => {
            return request(`/bookings/${id}`);
        },
        /**
         * Creates a new resource reservation.
         *
         * @param {Object} payload - Reservation parameters.
         * @param {string} payload.resourceId - Target facility ID.
         * @param {string} payload.startAt - ISO start timestamp.
         * @param {string} payload.endAt - ISO end timestamp.
         * @param {string} payload.title - Booking purpose/title.
         * @param {string} [payload.description] - Optional details.
         * @returns {Promise<{ booking: Object }>} Result payload containing the created reservation.
         */
        create: async (payload) => {
            const res = await request("/bookings", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const booking = (res && "booking" in res && res.booking) ? res.booking : res;
            return { booking };
        },
        cancel: async (id, reason) => {
            const res = await request(`/bookings/${id}/cancel`, {
                method: "POST",
                body: JSON.stringify(reason ? { reason } : {}),
            });
            const booking = (res && "booking" in res && res.booking) ? res.booking : res;
            return { booking };
        },
        approve: async (id, comment) => {
            const res = await request(`/bookings/${id}/approve`, {
                method: "POST",
                body: JSON.stringify(comment ? { comment } : {}),
            });
            const booking = (res && "booking" in res && res.booking) ? res.booking : res;
            return { booking };
        },
        reject: async (id, reason) => {
            const res = await request(`/bookings/${id}/reject`, {
                method: "POST",
                body: JSON.stringify({ reason }),
            });
            const booking = (res && "booking" in res && res.booking) ? res.booking : res;
            return { booking };
        },
        getCheckInToken: async (id) => {
            return request(`/bookings/${id}/check-in-token`, {
                method: "POST",
            });
        },
        checkIn: async (id, payload) => {
            return request(`/bookings/${id}/check-in`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        manualCheckIn: async (id, payload) => {
            return request(`/bookings/${id}/manual-check-in`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        checkout: async (id) => {
            return request(`/bookings/${id}/checkout`, {
                method: "POST",
            });
        },
        pardonNoShow: async (id, payload) => {
            return request(`/bookings/${id}/pardon-no-show`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        checkAvailability: async (params) => {
            const searchParams = new URLSearchParams({
                resourceId: params.resourceId,
                startAt: params.startAt,
                endAt: params.endAt,
            });
            return request(`/bookings/availability?${searchParams.toString()}`);
        },
        getBuildingAvailability: async (params) => {
            const searchParams = new URLSearchParams({
                building: params.building,
                startAt: params.startAt,
                endAt: params.endAt,
            });
            if (params.timezone)
                searchParams.set("timezone", params.timezone);
            if (params.limit)
                searchParams.set("limit", String(params.limit));
            if (params.userId)
                searchParams.set("userId", params.userId);
            return request(`/bookings/availability/building?${searchParams.toString()}`);
        },

        getSlots: async (params) => {
            const searchParams = new URLSearchParams({
                resourceId: params.resourceId,
                date: params.date,
            });
            if (params.timezone)
                searchParams.set("timezone", params.timezone);
            if (params.durationMinutes)
                searchParams.set("durationMinutes", String(params.durationMinutes));
            return request(`/bookings/slots?${searchParams.toString()}`);
        },
    },
    // Approvals Queue (Phase 3.2)
    approvals: {
        getPending: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.page)
                searchParams.set("page", String(params.page));
            if (params.limit)
                searchParams.set("limit", String(params.limit));
            if (params.sortBy)
                searchParams.set("sortBy", params.sortBy);
            const query = searchParams.toString();
            return request(`/approvals/pending${query ? `?${query}` : ""}`);
        },
    },
    // Approval Policy Administration (Phase 3.2)
    approvalPolicies: {
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.scopeType)
                searchParams.set("scopeType", params.scopeType);
            if (params.resourceId)
                searchParams.set("resourceId", params.resourceId);
            if (params.resourceTypeId)
                searchParams.set("resourceTypeId", params.resourceTypeId);
            if (params.requesterRole)
                searchParams.set("requesterRole", params.requesterRole);
            if (params.isActive !== undefined)
                searchParams.set("isActive", String(params.isActive));
            if (params.page)
                searchParams.set("page", String(params.page));
            if (params.limit)
                searchParams.set("limit", String(params.limit));
            const query = searchParams.toString();
            return request(`/approval-policies${query ? `?${query}` : ""}`);
        },
        getById: async (id) => {
            return request(`/approval-policies/${id}`);
        },
        create: async (payload) => {
            return request("/approval-policies", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        update: async (id, payload) => {
            return request(`/approval-policies/${id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        },
        toggleStatus: async (id, isActive) => {
            return request(`/approval-policies/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ isActive }),
            });
        },
        archive: async (id) => {
            return request(`/approval-policies/${id}`, {
                method: "DELETE",
            });
        },
    },
    // Institutional Analytics (Phase 3.5)
    analytics: {
        getOverview: async () => {
            return request("/analytics/overview");
        },
    },
    // Operating Hours & Availability Rules (Phase 2 - M2)
    availabilityRules: {
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.resource) searchParams.set("resource", params.resource);
            if (params.isActive !== undefined) searchParams.set("isActive", String(params.isActive));
            const query = searchParams.toString();
            return request(`/availability-rules${query ? `?${query}` : ""}`);
        },
        getById: async (id) => {
            return request(`/availability-rules/${id}`);
        },
        create: async (payload) => {
            return request("/availability-rules", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        update: async (id, payload) => {
            return request(`/availability-rules/${id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        },
        delete: async (id) => {
            return request(`/availability-rules/${id}`, {
                method: "DELETE",
            });
        },
    },
    // Blackouts & Holidays (Phase 2 - M2)
    blackouts: {
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.resource) searchParams.set("resource", params.resource);
            if (params.category) searchParams.set("category", params.category);
            if (params.isActive !== undefined) searchParams.set("isActive", String(params.isActive));
            const query = searchParams.toString();
            return request(`/blackouts${query ? `?${query}` : ""}`);
        },
        getById: async (id) => {
            return request(`/blackouts/${id}`);
        },
        create: async (payload) => {
            return request("/blackouts", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        update: async (id, payload) => {
            return request(`/blackouts/${id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        },
        delete: async (id) => {
            return request(`/blackouts/${id}`, {
                method: "DELETE",
            });
        },
    },
    // Departmental & Role Quotas (Phase 2 - M2)
    quotas: {
        list: async (params = {}) => {
            const searchParams = new URLSearchParams();
            if (params.subjectType) searchParams.set("subjectType", params.subjectType);
            if (params.scopeType) searchParams.set("scopeType", params.scopeType);
            if (params.department) searchParams.set("department", params.department);
            if (params.role) searchParams.set("role", params.role);
            if (params.isActive !== undefined) searchParams.set("isActive", String(params.isActive));
            const query = searchParams.toString();
            return request(`/quotas${query ? `?${query}` : ""}`);
        },
        getById: async (id) => {
            return request(`/quotas/${id}`);
        },
        create: async (payload) => {
            return request("/quotas", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        update: async (id, payload) => {
            return request(`/quotas/${id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        },
        delete: async (id) => {
            return request(`/quotas/${id}`, {
                method: "DELETE",
            });
        },
    },
};
