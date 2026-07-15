export interface DupeRecord {
  id: number;
  business_name: string;
  email?: string | null;
  phone?: string | null;
}

export function normBusinessName(s: string) {
  return s.toLowerCase()
    .replace(/\b(pty|ltd|limited|australia|au|the|and|&|group|services|solutions|co)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normPhone(s: string) {
  return s.replace(/\D/g, "");
}

function recordsMatch(a: DupeRecord, b: DupeRecord) {
  const nameMatch = !!normBusinessName(a.business_name) && normBusinessName(a.business_name) === normBusinessName(b.business_name);
  const emailMatch = !!a.email && !!b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase();
  const phoneMatch = !!a.phone && !!b.phone && normPhone(a.phone) === normPhone(b.phone) && normPhone(a.phone).length >= 8;
  return nameMatch || emailMatch || phoneMatch;
}

/** Groups of records that look like duplicates of each other (name/email/phone). */
export function findDuplicateGroups<T extends DupeRecord>(records: T[]): T[][] {
  const groups: T[][] = [];
  const seen = new Set<number>();
  for (let i = 0; i < records.length; i++) {
    if (seen.has(records[i].id)) continue;
    const group: T[] = [records[i]];
    for (let j = i + 1; j < records.length; j++) {
      if (seen.has(records[j].id)) continue;
      if (recordsMatch(records[i], records[j])) {
        group.push(records[j]);
        seen.add(records[j].id);
      }
    }
    if (group.length > 1) {
      groups.push(group);
      seen.add(records[i].id);
    }
  }
  return groups;
}

/** Why the members of a group matched: subset of ["name", "email", "phone"]. */
export function matchReasons(group: DupeRecord[]): string[] {
  const reasons = new Set<string>();
  const a = group[0];
  for (const b of group.slice(1)) {
    if (normBusinessName(a.business_name) === normBusinessName(b.business_name)) reasons.add("name");
    if (a.email && b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) reasons.add("email");
    if (a.phone && b.phone && normPhone(a.phone) === normPhone(b.phone)) reasons.add("phone");
  }
  return [...reasons];
}
