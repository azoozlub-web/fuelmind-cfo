"use strict";
/* FuelMind v1.5 RC3 — safety-critical domain helpers.
   Compiled with TypeScript strict mode to core.js; no runtime dependencies. */
(() => {
    'use strict';
    const MAX_AMOUNT = 1000000;
    const MAX_BUDGET = 10000000;
    const MAX_EXPENSES = 5000;
    const MAX_HISTORY = 200;
    const MAX_TOKEN_CHARS = 2800000;
    let uidCounter = 0;
    function safeText(value, max = 200) {
        return String(value ?? '')
            .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, max);
    }
    function isValidISODate(value) {
        const s = String(value ?? '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
            return false;
        const parts = s.split('-').map(Number);
        const y = parts[0];
        const m = parts[1];
        const d = parts[2];
        const date = new Date(Date.UTC(y, m - 1, d));
        return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    }
    function uid() {
        const c = globalThis.crypto;
        if (c && typeof c.randomUUID === 'function')
            return c.randomUUID();
        if (c && typeof c.getRandomValues === 'function') {
            const a = new Uint32Array(4);
            c.getRandomValues(a);
            return Array.from(a, n => n.toString(36).padStart(7, '0')).join('-');
        }
        uidCounter = (uidCounter + 1) >>> 0;
        return `fm-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
    }
    function csvSafe(value) {
        let s = String(value ?? '');
        if (/^[=+\-@]/.test(s))
            s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
    }
    function quickHash(text) {
        const s = String(text ?? '');
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h.toString(16).padStart(8, '0');
    }
    function sanitizeConfig(input, todayISO) {
        const cfg = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const budget = Number(cfg.budget);
        const cycleDays = Number(cfg.cycleDays);
        const cycleStart = safeText(cfg.cycleStart, 10);
        const savingsTarget = Number(cfg.savingsTarget);
        if (!Number.isFinite(budget) || budget < 1 || budget > MAX_BUDGET)
            throw new Error('الميزانية في النسخة خارج النطاق المسموح');
        if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 62)
            throw new Error('عدد أيام الدورة في النسخة غير صالح');
        if (!isValidISODate(cycleStart) || cycleStart > todayISO)
            throw new Error('تاريخ بداية الدورة في النسخة غير صالح أو مستقبلي');
        if (!Number.isFinite(savingsTarget) || savingsTarget < 0 || savingsTarget > budget)
            throw new Error('هدف التوفير في النسخة غير صالح');
        return { budget, cycleDays, cycleStart, savingsTarget };
    }
    function sanitizeExpenseArray(input, label, todayISO) {
        if (!Array.isArray(input))
            throw new Error(`${label}: سجل المصروفات مفقود`);
        if (input.length > MAX_EXPENSES)
            throw new Error(`${label}: عدد العمليات أكبر من ${MAX_EXPENSES}`);
        const ids = new Set();
        return input.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item))
                throw new Error(`${label}: العملية #${index + 1} ليست كائنًا صالحًا`);
            const e = item;
            const id = safeText(e.id, 100);
            const date = safeText(e.date, 10);
            const category = safeText(e.category, 100);
            const amount = Number(e.amount);
            if (!id)
                throw new Error(`${label}: العملية #${index + 1} بلا معرف`);
            if (ids.has(id))
                throw new Error(`${label}: معرف عملية مكرر: ${id}`);
            ids.add(id);
            if (!isValidISODate(date))
                throw new Error(`${label}: تاريخ غير صالح في العملية #${index + 1}`);
            if (date > todayISO)
                throw new Error(`${label}: تاريخ مستقبلي في العملية #${index + 1}`);
            if (!category)
                throw new Error(`${label}: تصنيف مفقود في العملية #${index + 1}`);
            if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT)
                throw new Error(`${label}: مبلغ غير صالح في العملية #${index + 1}`);
            return {
                id,
                date,
                category,
                vehicle: safeText(e.vehicle, 50),
                property: safeText(e.property, 50),
                meter: safeText(e.meter, 50),
                desc: safeText(e.desc, 140),
                note: safeText(e.note, 80),
                amount: Math.round(amount * 100) / 100,
                synced: e.synced === false ? false : true,
                createdAt: safeText(e.createdAt, 40),
                updatedAt: safeText(e.updatedAt, 40),
            };
        });
    }
    function sanitizeHistory(input, todayISO) {
        if (input == null)
            return [];
        if (!Array.isArray(input))
            throw new Error('سجل الدورات المؤرشفة غير صالح');
        if (input.length > MAX_HISTORY)
            throw new Error(`عدد الدورات المؤرشفة أكبر من ${MAX_HISTORY}`);
        return input.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item))
                throw new Error(`الدورة المؤرشفة #${index + 1} غير صالحة`);
            const x = item;
            const expenses = Array.isArray(x.expenses) ? sanitizeExpenseArray(x.expenses, `أرشيف #${index + 1}`, todayISO) : [];
            const cycleStart = safeText(x.cycleStart, 10);
            const cycleDays = Number(x.cycleDays);
            const budget = Number(x.budget);
            const savingsTarget = Number(x.savingsTarget);
            const declared = Number(x.total);
            if (!isValidISODate(cycleStart) || cycleStart > todayISO)
                throw new Error(`تاريخ بداية الأرشيف #${index + 1} غير صالح`);
            if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 62)
                throw new Error(`عدد أيام الأرشيف #${index + 1} غير صالح`);
            if (!Number.isFinite(budget) || budget < 1 || budget > MAX_BUDGET)
                throw new Error(`ميزانية الأرشيف #${index + 1} غير صالحة`);
            if (!Number.isFinite(savingsTarget) || savingsTarget < 0 || savingsTarget > budget)
                throw new Error(`هدف توفير الأرشيف #${index + 1} غير صالح`);
            const computed = expenses.reduce((sum, e) => sum + e.amount, 0);
            if (expenses.length && Number.isFinite(declared) && Math.abs(declared - computed) > 0.011)
                throw new Error(`إجمالي الأرشيف #${index + 1} لا يطابق عملياته`);
            return {
                id: safeText(x.id, 100) || uid(),
                cycleStart,
                cycleDays,
                budget,
                savingsTarget,
                total: expenses.length ? Math.round(computed * 100) / 100 : Math.max(0, Number.isFinite(declared) ? declared : 0),
                expenses,
                archivedAt: safeText(x.archivedAt, 40),
            };
        });
    }
    function decodeRestoreToken(text) {
        const raw = String(text ?? '');
        if (raw.length > MAX_TOKEN_CHARS)
            throw new Error('رمز الاستعادة أكبر من الحد الآمن');
        let s = raw.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        if (!/^[A-Za-z0-9+/=]*$/.test(s))
            throw new Error('رمز الاستعادة يحتوي محارف غير صالحة');
        while (s.length % 4)
            s += '=';
        const bin = atob(s);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1)
            bytes[i] = bin.charCodeAt(i);
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    const api = Object.freeze({
        safeText,
        isValidISODate,
        uid,
        csvSafe,
        quickHash,
        sanitizeConfig,
        sanitizeExpenseArray,
        sanitizeHistory,
        decodeRestoreToken,
        limits: Object.freeze({ MAX_AMOUNT, MAX_BUDGET, MAX_EXPENSES, MAX_HISTORY, MAX_TOKEN_CHARS }),
    });
    globalThis.FuelMindCore = api;
})();
