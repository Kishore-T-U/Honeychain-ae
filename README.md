# HoneyChain-AE 🍯🛡️

> *"Claims should never outrun the evidence behind them."*

HoneyChain-AE is a software-first traceability platform built for beekeepers, FPOs, and consumers. It combines **IoT hive telemetry**, **Edge AI** for hive health diagnostics, **immutable lot verification**, and a consumer-facing QR interface to deliver transparent, end-to-end honey supply chain assurance.

---

## 🚀 Key Innovations & IoT Integration

* **IoT Hive Monitoring:** Directly ingests hive telemetry (`temperature_c`, `humidity_pct`, and device health `sensor_ok`) via REST/MQTT endpoints to ensure physical harvesting conditions match the digital claims.
* **Acoustic Edge AI:** Utilizes smartphone-as-IoT or basic edge microphones to capture hive acoustics, processing the audio to generate a 0-1 `acoustic_risk_score` for early disease and swarming detection.
* **Digital Scale Binding:** Automates harvest event logging by capturing `measured_mass_kg` directly from digital scales, binding it to the specific `container_id` and `apiary_id`.
* **DAG Fractional Lineage:** Handles complex honey blending tracking, maintaining transparent genealogy from multiple apiaries to final packaged lots.
* **Gasless Transactions & ZK-Proofs:** Leverages Biconomy on Polygon L2 for frictionless blockchain logging while utilizing Zero-Knowledge proofs to preserve beekeeper location privacy.

---

## 🏗️ Architecture Stack

* **Frontend / PWA (Next.js App Router):** Powers consumer-facing interfaces, role-based portals, and SSR authentication via Supabase.
* **Backend / Claim Engine (FastAPI):** Handles IoT sensor data ingestion, executes the acoustic ML risk model, and processes evidence claims.
* **Database & Auth (Supabase):** PostgreSQL with strict Row-Level Security (RLS) enforcing data access across stakeholders.
* **Smart Contracts (Polygon L2):** Decentralized, tamper-proof ledger for verifiable supply chain claims.

---

## 👁️ Five Views Into the Same Ledger

HoneyChain-AE features role-based dashboards tailored for every stakeholder in the supply chain:

* **Beekeeper:** Real-time IoT sensor readings, confidence-gated disease-risk alerts, and harvest logging.
* **FPO / Collector:** Measured-mass intake, blend genealogy, and evidence-backed sourcing.
* **Buyer / Processor:** Eligible/ineligible state tracking per lot with explicit missing evidence indicators.
* **Government:** Ecosystem-level oversight complementing existing regulatory portals.
* **Consumer (HoneyPass):** Simple story view paired with an optional technical evidence layer.

---

## 📄 License

Built for hackathon innovation under open standards.
