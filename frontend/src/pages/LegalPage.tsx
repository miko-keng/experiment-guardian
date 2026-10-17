import React from "react";

type LegalPageProps = { kind: "privacy" | "terms" };

export const LegalPage: React.FC<LegalPageProps> = ({ kind }) => {
  const privacy = kind === "privacy";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-slate-700">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-amber-600">
        Experiment Guardian
      </p>
      <h1 className="mb-6 text-4xl font-bold text-slate-950">
        {privacy ? "Privacy Policy" : "Terms of Use"}
      </h1>
      <p className="mb-8 text-sm text-slate-500">Effective October 17, 2026</p>
      {privacy ? (
        <div className="space-y-6 leading-7">
          <section><h2 className="text-xl font-semibold text-slate-900">Information used</h2><p>Experiment Guardian processes research notes, transcripts, experiment fields, audit findings, decisions, and approval responses that you submit. Alexa+ sends only the information needed to run the MCP tool you request.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">Purpose</h2><p>The data is used to build experiment records, run reproducibility checks, propose traceable changes, and generate reports. Proposed changes require explicit approval before they are applied.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">Storage and sharing</h2><p>The demonstration service stores project data in its application database. Data is not sold. Hosting providers may process data only to operate the service. Do not submit confidential, regulated, or personally identifying research data to the public demonstration.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">Control</h2><p>You may reject proposed changes and delete demonstration experiments from the application. The public demo may be reset during deployment.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">Contact</h2><p>For privacy questions, open an issue in the Experiment Guardian GitHub repository.</p></section>
        </div>
      ) : (
        <div className="space-y-6 leading-7">
          <section><h2 className="text-xl font-semibold text-slate-900">Demonstration service</h2><p>Experiment Guardian is a hackathon prototype provided for evaluation and educational use. It may change, restart, or become unavailable without notice.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">Research responsibility</h2><p>Audit findings and AI suggestions assist documentation. They do not replace scientific review, safety review, ethics approval, or professional judgment. You remain responsible for validating every record and decision.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">Acceptable use</h2><p>Do not use the public demonstration for harmful activity or upload confidential, regulated, copyrighted, or personally identifying material without authorization.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-900">No warranty</h2><p>The service is provided as available without warranties. Generated suggestions may be incomplete or incorrect.</p></section>
        </div>
      )}
    </div>
  );
};
