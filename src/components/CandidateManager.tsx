"use client";

import { useState, useRef, useCallback } from "react";
import { Candidate } from "@/types";
import * as XLSX from "xlsx";

// ─── helpers ───────────────────────────────────────────────────────────────

function makeId() {
  return "c" + Math.random().toString(36).slice(2, 8);
}

const AVAILABILITY_OPTIONS: Candidate["availability"][] = [
  "immediately",
  "2_weeks",
  "1_month",
  "3_months",
  "not_looking",
];

const AVAILABILITY_LABELS: Record<Candidate["availability"], string> = {
  immediately: "Immediately",
  "2_weeks": "2 Weeks Notice",
  "1_month": "1 Month Notice",
  "3_months": "3 Months Notice",
  not_looking: "Not Looking",
};

const EMPTY_FORM: Omit<Candidate, "id"> = {
  name: "",
  title: "",
  location: "",
  yearsExperience: 0,
  skills: [],
  education: "",
  previousCompanies: [],
  summary: "",
  availability: "immediately",
  preferredRoles: [],
  salaryExpectation: "",
  linkedinHeadline: "",
};

const EXCEL_TEMPLATE_HEADERS = [
  "name",
  "title",
  "location",
  "yearsExperience",
  "skills",
  "education",
  "previousCompanies",
  "summary",
  "availability",
  "preferredRoles",
  "salaryExpectation",
  "linkedinHeadline",
];

const SAMPLE_PASTE = `[
  {
    "name": "Jane Smith",
    "title": "Senior Software Engineer",
    "location": "New York, NY",
    "yearsExperience": 6,
    "skills": ["React", "TypeScript", "Node.js", "PostgreSQL"],
    "education": "BS Computer Science, MIT",
    "previousCompanies": ["Google", "Stripe"],
    "summary": "Full-stack engineer with strong fintech background.",
    "availability": "2_weeks",
    "preferredRoles": ["Senior Engineer", "Staff Engineer"],
    "salaryExpectation": "$180k - $210k",
    "linkedinHeadline": "Senior SWE @Google | Full Stack | TypeScript"
  }
]`;

function rowToCandidate(row: Record<string, unknown>): Candidate {
  const str = (v: unknown) => String(v ?? "").trim();
  const arr = (v: unknown) =>
    str(v)
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    id: makeId(),
    name: str(row.name),
    title: str(row.title),
    location: str(row.location),
    yearsExperience: Number(row.yearsExperience) || 0,
    skills: arr(row.skills),
    education: str(row.education),
    previousCompanies: arr(row.previousCompanies),
    summary: str(row.summary),
    availability: (str(row.availability) as Candidate["availability"]) || "immediately",
    preferredRoles: arr(row.preferredRoles),
    salaryExpectation: str(row.salaryExpectation),
    linkedinHeadline: str(row.linkedinHeadline),
  };
}

// ─── sub-components ────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  onRemove,
}: {
  candidate: Candidate;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {candidate.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9" }}>
          {candidate.name}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
          {candidate.title} · {candidate.yearsExperience}y · {candidate.location}
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {candidate.skills.slice(0, 5).map((s) => (
            <span
              key={s}
              style={{
                fontSize: 10,
                background: "rgba(99,102,241,0.18)",
                color: "#a5b4fc",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              {s}
            </span>
          ))}
          {candidate.skills.length > 5 && (
            <span style={{ fontSize: 10, color: "#64748b" }}>
              +{candidate.skills.length - 5} more
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(candidate.id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#64748b",
          fontSize: 16,
          padding: 2,
          lineHeight: 1,
          flexShrink: 0,
        }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function FormRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: "#94a3b8",
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{hint}</div>
      )}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#f1f5f9",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

// ─── ManualTab ──────────────────────────────────────────────────────────────

function ManualTab({ onAdd }: { onAdd: (c: Candidate) => void }) {
  const [form, setForm] = useState<Omit<Candidate, "id">>(EMPTY_FORM);
  const [skillsRaw, setSkillsRaw] = useState("");
  const [companiesRaw, setCompaniesRaw] = useState("");
  const [rolesRaw, setRolesRaw] = useState("");
  const [error, setError] = useState("");

  const set = (k: keyof typeof EMPTY_FORM, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.name.trim() || !form.title.trim()) {
      setError("Name and Title are required.");
      return;
    }
    setError("");
    const candidate: Candidate = {
      ...form,
      id: makeId(),
      skills: skillsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      previousCompanies: companiesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      preferredRoles: rolesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onAdd(candidate);
    setForm(EMPTY_FORM);
    setSkillsRaw("");
    setCompaniesRaw("");
    setRolesRaw("");
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormRow label="Full Name *">
          <input
            style={INPUT_STYLE}
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </FormRow>
        <FormRow label="Job Title *">
          <input
            style={INPUT_STYLE}
            placeholder="Senior Software Engineer"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </FormRow>
        <FormRow label="Location">
          <input
            style={INPUT_STYLE}
            placeholder="New York, NY"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </FormRow>
        <FormRow label="Years of Experience">
          <input
            style={INPUT_STYLE}
            type="number"
            min={0}
            placeholder="5"
            value={form.yearsExperience || ""}
            onChange={(e) => set("yearsExperience", Number(e.target.value))}
          />
        </FormRow>
      </div>

      <FormRow label="Skills" hint="Comma-separated: React, TypeScript, Node.js">
        <input
          style={INPUT_STYLE}
          placeholder="React, TypeScript, Node.js, PostgreSQL"
          value={skillsRaw}
          onChange={(e) => setSkillsRaw(e.target.value)}
        />
      </FormRow>

      <FormRow label="Education">
        <input
          style={INPUT_STYLE}
          placeholder="BS Computer Science, MIT"
          value={form.education}
          onChange={(e) => set("education", e.target.value)}
        />
      </FormRow>

      <FormRow label="Previous Companies" hint="Comma-separated">
        <input
          style={INPUT_STYLE}
          placeholder="Google, Stripe"
          value={companiesRaw}
          onChange={(e) => setCompaniesRaw(e.target.value)}
        />
      </FormRow>

      <FormRow label="Summary">
        <textarea
          style={{ ...INPUT_STYLE, resize: "vertical", minHeight: 60 }}
          placeholder="Brief professional summary..."
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
      </FormRow>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormRow label="Availability">
          <select
            style={INPUT_STYLE}
            value={form.availability}
            onChange={(e) => set("availability", e.target.value as Candidate["availability"])}
          >
            {AVAILABILITY_OPTIONS.map((a) => (
              <option key={a} value={a} style={{ background: "#1e293b" }}>
                {AVAILABILITY_LABELS[a]}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Salary Expectation">
          <input
            style={INPUT_STYLE}
            placeholder="$150k - $180k"
            value={form.salaryExpectation}
            onChange={(e) => set("salaryExpectation", e.target.value)}
          />
        </FormRow>
      </div>

      <FormRow label="Preferred Roles" hint="Comma-separated">
        <input
          style={INPUT_STYLE}
          placeholder="Senior Engineer, Staff Engineer"
          value={rolesRaw}
          onChange={(e) => setRolesRaw(e.target.value)}
        />
      </FormRow>

      <FormRow label="LinkedIn Headline">
        <input
          style={INPUT_STYLE}
          placeholder="Senior SWE @Google | Full Stack"
          value={form.linkedinHeadline}
          onChange={(e) => set("linkedinHeadline", e.target.value)}
        />
      </FormRow>

      {error && (
        <div
          style={{
            fontSize: 12,
            color: "#f87171",
            marginBottom: 12,
            background: "rgba(248,113,113,0.1)",
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleAdd}
        style={{
          width: "100%",
          padding: "10px 0",
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        + Add Candidate
      </button>
    </div>
  );
}

// ─── ImportTab ──────────────────────────────────────────────────────────────

function ImportTab({ onAdd }: { onAdd: (candidates: Candidate[]) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      EXCEL_TEMPLATE_HEADERS,
      [
        "Jane Smith",
        "Senior Software Engineer",
        "New York, NY",
        6,
        "React, TypeScript, Node.js, PostgreSQL",
        "BS Computer Science, MIT",
        "Google, Stripe",
        "Full-stack engineer with strong fintech background.",
        "2_weeks",
        "Senior Engineer, Staff Engineer",
        "$180k - $210k",
        "Senior SWE @Google | Full Stack",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, "catalyst_candidates_template.xlsx");
  };

  const processFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext || "")) {
        setStatus({ type: "error", msg: "Only .xlsx, .xls, or .csv files are supported." });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const wb = XLSX.read(data, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

          if (rows.length === 0) {
            setStatus({ type: "error", msg: "No data rows found in the file." });
            return;
          }

          const candidates = rows.map(rowToCandidate).filter((c) => c.name);
          if (candidates.length === 0) {
            setStatus({ type: "error", msg: "Could not parse any candidates. Check that 'name' column exists." });
            return;
          }

          onAdd(candidates);
          setStatus({ type: "success", msg: `Successfully imported ${candidates.length} candidate${candidates.length > 1 ? "s" : ""}.` });
        } catch (err) {
          setStatus({ type: "error", msg: `Parse error: ${String(err)}` });
        }
      };
      reader.readAsBinaryString(file);
    },
    [onAdd]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#6366f1" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 12,
          padding: "32px 20px",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s",
          background: dragOver ? "rgba(99,102,241,0.06)" : "transparent",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 500 }}>
          Drop your Excel or CSV file here
        </div>
        <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
          or click to browse · supports .xlsx, .xls, .csv
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {status && (
        <div
          style={{
            fontSize: 13,
            color: status.type === "success" ? "#4ade80" : "#f87171",
            background:
              status.type === "success"
                ? "rgba(74,222,128,0.08)"
                : "rgba(248,113,113,0.08)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 16,
          }}
        >
          {status.type === "success" ? "✓ " : "✗ "}
          {status.msg}
        </div>
      )}

      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>
          Required columns in your spreadsheet:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EXCEL_TEMPLATE_HEADERS.map((h) => (
            <code
              key={h}
              style={{
                fontSize: 11,
                background: "rgba(99,102,241,0.15)",
                color: "#a5b4fc",
                borderRadius: 4,
                padding: "2px 7px",
              }}
            >
              {h}
            </code>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
          For array fields (skills, previousCompanies, preferredRoles), separate values with commas within the cell.
          <br />
          Availability values: <code style={{ color: "#a5b4fc" }}>immediately | 2_weeks | 1_month | 3_months | not_looking</code>
        </div>
      </div>

      <button
        onClick={downloadTemplate}
        style={{
          width: "100%",
          padding: "9px 0",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          color: "#94a3b8",
          fontWeight: 500,
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        ⬇ Download Excel Template
      </button>
    </div>
  );
}

// ─── PasteTab ───────────────────────────────────────────────────────────────

function PasteTab({ onAdd }: { onAdd: (candidates: Candidate[]) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const tryParse = () => {
    setError("");
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Nothing to parse.");
      return;
    }

    // Try JSON first
    try {
      const parsed = JSON.parse(trimmed);
      const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const candidates: Candidate[] = arr
        .map((item) => {
          const obj = item as Record<string, unknown>;
          // Normalise array fields that might be comma-strings
          const normalise = (v: unknown) =>
            Array.isArray(v)
              ? (v as string[])
              : String(v ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);

          return {
            id: makeId(),
            name: String(obj.name ?? ""),
            title: String(obj.title ?? ""),
            location: String(obj.location ?? ""),
            yearsExperience: Number(obj.yearsExperience) || 0,
            skills: normalise(obj.skills),
            education: String(obj.education ?? ""),
            previousCompanies: normalise(obj.previousCompanies),
            summary: String(obj.summary ?? ""),
            availability: (String(obj.availability ?? "immediately") as Candidate["availability"]),
            preferredRoles: normalise(obj.preferredRoles),
            salaryExpectation: String(obj.salaryExpectation ?? ""),
            linkedinHeadline: String(obj.linkedinHeadline ?? ""),
          };
        })
        .filter((c) => c.name);

      if (candidates.length === 0) {
        setError("No valid candidates found. Make sure each object has at least a 'name' field.");
        return;
      }
      onAdd(candidates);
      setText("");
      return;
    } catch {
      // fall through to CSV attempt
    }

    // Try CSV
    try {
      const lines = trimmed.split("\n").filter(Boolean);
      if (lines.length < 2) {
        setError("Need at least a header row and one data row for CSV.");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const candidates: Candidate[] = lines
        .slice(1)
        .map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
          return rowToCandidate(obj);
        })
        .filter((c) => c.name);

      if (candidates.length === 0) {
        setError("No valid candidates found in CSV.");
        return;
      }
      onAdd(candidates);
      setText("");
      return;
    } catch {
      setError("Could not parse as JSON or CSV. Check the format and try again.");
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
        Paste a JSON array of candidate objects, or CSV with headers. Both formats are auto-detected.
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE_PASTE}
        style={{
          ...INPUT_STYLE,
          resize: "vertical",
          minHeight: 220,
          fontFamily: "monospace",
          fontSize: 12,
          lineHeight: 1.6,
          marginBottom: 10,
        }}
      />

      {error && (
        <div
          style={{
            fontSize: 12,
            color: "#f87171",
            background: "rgba(248,113,113,0.08)",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 10,
          }}
        >
          ✗ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={tryParse}
          style={{
            flex: 1,
            padding: "10px 0",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Parse & Add
        </button>
        <button
          onClick={() => setText(SAMPLE_PASTE)}
          style={{
            padding: "10px 16px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#94a3b8",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Load Sample
        </button>
      </div>
    </div>
  );
}

// ─── Main CandidateManager ──────────────────────────────────────────────────

interface Props {
  candidates: Candidate[];
  onChange: (candidates: Candidate[]) => void;
}

type Tab = "list" | "manual" | "import" | "paste";

export default function CandidateManager({ candidates, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("list");
  const [expanded, setExpanded] = useState(true);

  const addMany = (newCandidates: Candidate[]) => {
    onChange([...candidates, ...newCandidates]);
    setTab("list");
  };
  const addOne = (c: Candidate) => addMany([c]);
  const remove = (id: string) => onChange(candidates.filter((c) => c.id !== id));
  const clearAll = () => onChange([]);

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: "list", label: `Candidates (${candidates.length})`, emoji: "👥" },
    { key: "manual", label: "Manual Entry", emoji: "✍️" },
    { key: "import", label: "Import File", emoji: "📂" },
    { key: "paste", label: "Paste Data", emoji: "📋" },
  ];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>👥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>
              Candidate Pool
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {candidates.length === 0
                ? "No candidates loaded — using default sample data"
                : `${candidates.length} candidate${candidates.length > 1 ? "s" : ""} loaded`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {candidates.length > 0 && (
            <span
              style={{
                fontSize: 11,
                background: "rgba(99,102,241,0.2)",
                color: "#a5b4fc",
                borderRadius: 20,
                padding: "2px 10px",
                fontWeight: 600,
              }}
            >
              {candidates.length} loaded
            </span>
          )}
          {candidates.length === 0 && (
            <span
              style={{
                fontSize: 11,
                background: "rgba(250,204,21,0.15)",
                color: "#fbbf24",
                borderRadius: 20,
                padding: "2px 10px",
                fontWeight: 600,
              }}
            >
              using sample
            </span>
          )}
          <span style={{ color: "#475569", fontSize: 18 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              overflowX: "auto",
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={(e) => { e.stopPropagation(); setTab(t.key); }}
                style={{
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: tab === t.key ? "2px solid #6366f1" : "2px solid transparent",
                  color: tab === t.key ? "#a5b4fc" : "#64748b",
                  fontWeight: tab === t.key ? 600 : 400,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "20px" }}>
            {/* List tab */}
            {tab === "list" && (
              <div>
                {candidates.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "28px 20px",
                      color: "#475569",
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                      No custom candidates yet
                    </div>
                    <div style={{ fontSize: 12 }}>
                      The pipeline will use the built-in sample data. Use the tabs above to add your own candidates.
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: 12,
                      }}
                    >
                      <button
                        onClick={clearAll}
                        style={{
                          background: "rgba(248,113,113,0.1)",
                          border: "1px solid rgba(248,113,113,0.2)",
                          color: "#f87171",
                          borderRadius: 6,
                          padding: "5px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {candidates.map((c) => (
                        <CandidateCard key={c.id} candidate={c} onRemove={remove} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "manual" && <ManualTab onAdd={addOne} />}
            {tab === "import" && <ImportTab onAdd={addMany} />}
            {tab === "paste" && <PasteTab onAdd={addMany} />}
          </div>
        </div>
      )}
    </div>
  );
}
