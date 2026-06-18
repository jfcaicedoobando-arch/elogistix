import { createClient } from "@supabase/supabase-js";
import { pdf } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import React from "react";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";

const url = "https://eorqadkulqtneqjbsblk.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcnFhZGt1bHF0bmVxamJzYmxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzM5MzEsImV4cCI6MjA4NzgwOTkzMX0.bNeS84nv01bheza5wL5l8N-2A2OONn0fKKkZQ8ADZRc";
const sb = createClient(url, anon);

const { data: cot, error } = await sb.from("cotizaciones").select("*").eq("id", "20b35611-f657-429f-b9d7-520a9d1a65b2").single();
if (error) { console.error(error); process.exit(1); }
const { data: tipos } = await sb.from("tipos_contenedor").select("*");

const blob = await pdf(React.createElement(CotizacionDocument, { cotizacion: cot as any, emisor: undefined, tiposContenedor: (tipos ?? []) as any })).toBlob();
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync("/tmp/cot.pdf", buf);
console.log("OK", buf.length, "bytes");
