const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "al-rahim-group-jwt-secret-2026";

let pool;

async function initDatabase(poolInstance) {
  try {
    const client = await poolInstance.connect();
    try {
      console.log("🚀 Initializing database schema & actual dataset...");

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Member',
          job_title TEXT DEFAULT 'Specialist',
          remarks TEXT DEFAULT '',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE IF NOT EXISTS programs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT,
          description TEXT,
          domain TEXT,
          priority TEXT DEFAULT 'Medium',
          status TEXT DEFAULT 'Active',
          start_date DATE,
          end_date DATE,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domain TEXT,
          about_title TEXT,
          about_description TEXT,
          status TEXT DEFAULT 'Active',
          priority TEXT DEFAULT 'Medium',
          start_date DATE,
          deadline DATE,
          progress INTEGER DEFAULT 0,
          program_id TEXT,
          manager_id TEXT,
          project_manager_id TEXT,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS program_projects (
          id TEXT PRIMARY KEY,
          program_id TEXT NOT NULL,
          name TEXT NOT NULL,
          domain TEXT,
          about_title TEXT,
          about_description TEXT,
          status TEXT DEFAULT 'In Progress',
          priority TEXT DEFAULT 'Medium',
          start_date DATE,
          deadline DATE,
          created_by TEXT,
          assigned_to TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS project_members (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT DEFAULT 'Contributor',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS team_members (
          team_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (team_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          title TEXT,
          description TEXT,
          status TEXT DEFAULT 'To Do',
          priority TEXT DEFAULT 'Medium',
          start_date DATE,
          due_date DATE,
          project_id TEXT,
          assignee_id TEXT,
          assigned_to TEXT,
          created_by TEXT,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS program_project_tasks (
          id TEXT PRIMARY KEY,
          program_project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'To Do',
          priority TEXT DEFAULT 'Medium',
          assigned_to TEXT,
          due_date DATE,
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS program_project_members (
          program_project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          assigned_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (program_project_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS task_work_parts (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'To Do',
          created_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS task_submissions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          link TEXT NOT NULL,
          description TEXT,
          version INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS task_challenges (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          challenge TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS task_attachments (
          id TEXT PRIMARY KEY DEFAULT 'att-' || extract(epoch from now())::bigint || '-' || floor(random()*1000000)::text,
          task_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT,
          mime_type TEXT,
          file_size INTEGER DEFAULT 0,
          file_path TEXT,
          file_content BYTEA,
          uploaded_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS project_reports (
          id TEXT PRIMARY KEY DEFAULT 'rpt-' || extract(epoch from now())::bigint || '-' || floor(random()*1000000)::text,
          project_id TEXT NOT NULL UNIQUE,
          title TEXT,
          content TEXT,
          format TEXT DEFAULT 'text',
          file_path TEXT,
          submitted_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS daily_updates (
          id TEXT PRIMARY KEY DEFAULT 'dup-' || extract(epoch from now())::bigint || '-' || floor(random()*1000000)::text,
          user_id TEXT NOT NULL,
          date DATE DEFAULT CURRENT_DATE,
          content TEXT NOT NULL,
          kpi_score NUMERIC,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      

        -- Migrations for remarks, task status, and compulsory time fields
        ALTER TABLE users ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TEXT DEFAULT '17:00';
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00';
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline_time TEXT DEFAULT '17:00';
        ALTER TABLE program_projects ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00';
        ALTER TABLE program_projects ADD COLUMN IF NOT EXISTS deadline_time TEXT DEFAULT '17:00';
        ALTER TABLE programs ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00';
        ALTER TABLE programs ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '17:00';
        ALTER TABLE program_project_tasks ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00';
        ALTER TABLE program_project_tasks ADD COLUMN IF NOT EXISTS due_time TEXT DEFAULT '17:00';
        UPDATE tasks SET status = 'Completed' WHERE status = 'Done';
        UPDATE program_project_tasks SET status = 'Completed' WHERE status = 'Done';
`);

      // Seed users with rotated credentials
      const adminHash = bcrypt.hashSync("Arg@Admin#2026!X9qL$", 10);
      const asadHash = bcrypt.hashSync("Arg@Asad2026!", 10);
      const qasimHash = bcrypt.hashSync("Arg@Qasim2026!", 10);
      const fahadHash = bcrypt.hashSync("Arg@Fahad2026!", 10);
      const ajiyaHash = bcrypt.hashSync("Arg@Ajiya2026!", 10);
      const hibaHash = bcrypt.hashSync("Arg@Hiba2026!", 10);
      const kinjalHash = bcrypt.hashSync("Arg@Kinjal2026!", 10);
      const khizraHash = bcrypt.hashSync("Arg@Khizra2026!", 10);

      // Seed Dedicated System Administrator with strong credentials
      await client.query(`
        INSERT INTO users (id, full_name, email, password_hash, role, job_title, is_active)
        VALUES 
          ('usr-admin-system', 'System Administrator', 'admin@argplatform.com', '${adminHash}', 'System Administrator', 'Enterprise System Administrator & Security Lead', true)
        ON CONFLICT (email) DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          password_hash = '${adminHash}',
          role = 'System Administrator',
          job_title = 'Enterprise System Administrator & Security Lead',
          is_active = true,
          updated_at = NOW();

        -- Also ensure existing admin account (asadali@alrahimgroup.com) is synchronized with strong admin credentials
        UPDATE users 
        SET password_hash = '${adminHash}', role = 'System Administrator', is_active = true, updated_at = NOW()
        WHERE email = 'asadali@alrahimgroup.com';
      `);

      await client.query(`
        INSERT INTO users (id, full_name, email, password_hash, role, job_title, is_active)
        VALUES 
          ('usr-pm-asad', 'Asad Navaid', 'asad@argplatform.com', '${asadHash}', 'Project Manager', 'Project Director & Head of AI', true),
          ('usr-pm-qasim', 'Qasim', 'qasim@argplatform.com', '${qasimHash}', 'Project Manager', 'Project Manager & AI Operations Lead', true),
          ('usr-fahad', 'Fahad', 'fahad@argplatform.com', '${fahadHash}', 'Member', 'Edge AI & Computer Vision Engineer', true),
          ('usr-ajiya', 'Ajiya', 'ajiya@argplatform.com', '${ajiyaHash}', 'Member', 'AI Pipeline & Voice Architect', true),
          ('usr-hiba', 'Hiba', 'hiba@argplatform.com', '${hibaHash}', 'Member', 'Backend & Systems Integration Engineer', true),
          ('usr-kinjal', 'Kinjal', 'kinjal@argplatform.com', '${kinjalHash}', 'Member', 'RAG & Full-Stack AI Engineer', true),
          ('usr-khizra', 'Khizra', 'khizra@argplatform.com', '${khizraHash}', 'Member', 'Agentic AI & Workflow Specialist', true)
        ON CONFLICT (id) DO UPDATE SET 
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          job_title = EXCLUDED.job_title;
      `);

      // Seed program: QUANTUM AGENTIC RESEARCH CENTER (QARC)
      await client.query(`
        INSERT INTO programs (id, name, code, description, domain, priority, status, start_date, end_date, created_by)
        VALUES 
          ('prog-qarc', 'QUANTUM AGENTIC RESEARCH CENTER', 'QARC', 'Advanced AI agent research, multimodal pipelines, edge intelligence, and autonomous enterprise systems.', 'Agentic AI & Edge Intelligence', 'High', 'Active', '2026-08-01', '2026-12-31', 'usr-pm-asad')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          description = EXCLUDED.description;
      `);

      // Seed teams
      await client.query(`
        INSERT INTO teams (id, name, description, created_by)
        VALUES
          ('tm-edge-voice', 'Edge AI & Multimodal Speech Lab', 'Offline edge vision pipelines, speech synthesis, and voice cloning.', 'usr-pm-asad'),
          ('tm-agents-enterprise', 'Autonomous Agents & Enterprise Logistics', 'Multi-agent orchestration, commercial freight engines, and HR automation.', 'usr-pm-asad')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO team_members (team_id, user_id)
        VALUES
          ('tm-edge-voice', 'usr-pm-asad'),
          ('tm-edge-voice', 'usr-fahad'),
          ('tm-edge-voice', 'usr-ajiya'),
          ('tm-edge-voice', 'usr-kinjal'),
          ('tm-agents-enterprise', 'usr-hiba'),
          ('tm-agents-enterprise', 'usr-khizra')
        ON CONFLICT DO NOTHING;
      `);

      // Seed projects (All 5 under QARC)
      await client.query(`
        INSERT INTO projects (id, name, domain, about_title, about_description, status, priority, start_date, deadline, progress, program_id, manager_id, project_manager_id, created_by)
        VALUES 
          ('proj-voicescribe', 'VoiceScribe', 'Speech & Translation AI', 'Multilingual Meeting Transcription & Diarization', 'Real-time audio transcription, speaker diarization, multi-model translation, and meeting recordings analysis.', 'In Progress', 'High', '2026-08-15', '2026-09-30', 100, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-fishery', 'Fishery Automation', 'Edge Vision & Embedded AI', 'Offline Jetson Nano Freshness & Weighing Scale Pipeline', 'Offline Jetson Nano edge deployment on factory scales, YOLOv8n fish and eye freshness detectors, rotated bbox sizing, and ByteTrack packing dispatch telemetry.', 'In Progress', 'High', '2026-08-20', '2026-10-15', 50, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-hr-agent', 'HR Agent', 'Enterprise Workflow Automation', 'Autonomous Multi-Stage HR Workflow System', 'Autonomous candidate screening, 5-stage automated workflows, interview evaluations, dashboard UI, and sequence validation.', 'In Progress', 'Medium', '2026-08-20', '2026-09-25', 83, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-freight', 'AI Freight Forwarding Lifecycle', 'Logistics & Commercial AI', 'End-to-End Autonomous Freight & Commercial Engine', 'Commercial master data, tariff versioning, RFQ & Pricing agents, Sea FCL/Air Direct shipment workspaces, BL/AWB, financial ledger, DGR compliance, and exception control tower.', 'In Progress', 'High', '2026-09-01', '2026-11-15', 52, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-ai-tutor', 'AI Tutor', 'Conversational AI & Avatars', 'Multimodal Avatar & Local Real-Time Voice Tutor', 'SadTalker talking-head video rendering, Coqui XTTS-v2 code-mixed Urdu-English voice cloning, RAG document grounding, Faster-Whisper, and Silero VAD live voice loop.', 'In Progress', 'High', '2026-08-01', '2026-10-10', 80, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-uae-voice', 'UAE Voice Model for Competition', 'Arabic Speech AI & Voice Synthesis', 'Emirati Dialect Competitive Neural Voice AI', 'Specialized Emirati Arabic neural voice synthesis, dialectal acoustic modeling, prosody transfer, and ultra-low latency inference for the UAE International AI Competition.', 'Unassigned', 'High', '2026-08-25', '2026-10-30', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-axiom', 'Axiom', 'Formal Reasoning & Neural-Symbolic AI', 'Automated Mathematical Proof & Logic Engine', 'Neural-symbolic theorem prover, automated code invariant generation, formal verification solvers, and strict mathematical proof validation for mission-critical systems.', 'Unassigned', 'High', '2026-08-20', '2026-11-15', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-ecommerce-agent', 'Ecommerce Agent', 'Autonomous Commerce & Conversational Selling', 'Autonomous Multi-Channel Shopping & Cart Agent', 'Autonomous agentic shopping assistant with dynamic product catalog search, real-time inventory synchronization, intelligent upsell recommendations, and headless cart orchestration.', 'Unassigned', 'High', '2026-08-22', '2026-10-25', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-embassy-reachout', 'Embassy Reach out', 'Diplomatic Intelligence & Automated Outreach', 'Autonomous Diplomatic Communications & Partner Engagement', 'Automated diplomatic stakeholder mapping, bilateral protocol compliance, customized diplomatic communication pipelines, and international partnership dossier generation.', 'Unassigned', 'Medium', '2026-08-28', '2026-11-20', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-retina-scan', 'Retina Scan Early Disease Detection', 'Medical Imaging & Diagnostic AI', 'Deep Learning Fundus Image Pathology Classification', 'High-resolution retinal fundus photography analysis using hybrid CNN-ViT architectures for automated early detection of diabetic retinopathy, glaucoma, and macular degeneration.', 'Unassigned', 'High', '2026-08-15', '2026-10-31', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-fmd-detection', 'Foot and Mouth Disease (FMD) Detection in Animals', 'Veterinary Computer Vision & Edge Diagnostics', 'Livestock Lesion Detection & Thermal Screening Vision Pipeline', 'Real-time multi-spectral thermal and RGB computer vision pipeline deployed on edge cameras for early detection of FMD vesicular lesions in cattle hooves and muzzles.', 'Unassigned', 'High', '2026-08-18', '2026-11-10', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-marketing-agent', 'Marketing Agent', 'Autonomous Marketing & Growth Automation', 'Autonomous Omnichannel Campaign & Content Engine', 'Autonomous growth agent capable of market research, high-conversion copy generation, dynamic creative synthesis, SEO keyword cluster analysis, and cross-platform campaign optimization.', 'Unassigned', 'Medium', '2026-08-25', '2026-10-20', 0, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-pvis', 'Pakistan Vehicle Intelligence System (PVIS)', 'Edge AI & Computer Vision', 'AI-powered vehicle monitoring system', 'Detects vehicles, reads Pakistani license plates using OCR, tracks entry/exit sessions, stores data locally on Jetson Nano, and syncs everything live to a cloud dashboard.', 'Completed', 'High', '2026-08-01', '2026-08-20', 100, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-track-trace', 'M&S Aviators: Track & Trace', 'Logistics & Automation', 'Automated AWB Scraper & Emails', 'Custom full-stack app automating Ethiopian Airlines Cargo AWB tracking via Playwright, async scheduling, and branded HTML emails.', 'Completed', 'High', '2026-08-21', '2026-09-04', 100, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-pia-cargospot', 'PIA CargoSpot Automation', 'Logistics & Automation', 'Async Cargo Flight Polling Bot', 'Optimized async browser automation tool for monitoring and extracting cargo flights from the CHAMP CargoSpot portal. Features Playwright, MooTools handling, and Excel I/O.', 'Completed', 'High', '2026-09-01', '2026-09-15', 100, 'prog-qarc', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          domain = EXCLUDED.domain,
          about_title = EXCLUDED.about_title,
          about_description = EXCLUDED.about_description,
          status = EXCLUDED.status,
          progress = EXCLUDED.progress;
      `);

      // Seed program_projects
      await client.query(`
        INSERT INTO program_projects (id, program_id, name, domain, about_title, about_description, status, priority, start_date, deadline, created_by, assigned_to)
        VALUES 
          ('pp-voicescribe', 'prog-qarc', 'VoiceScribe', 'Speech & Translation AI', 'Meeting Audio & Translation Pipeline', 'Multi-model transcription and diarization.', 'In Progress', 'High', '2026-08-15', '2026-09-30', 'usr-pm-asad', 'usr-ajiya'),
          ('pp-fishery', 'prog-qarc', 'Fishery Automation', 'Edge Vision & Embedded AI', 'Jetson Nano Scale Vision System', 'Real-time fish freshness grading and count tracking.', 'In Progress', 'High', '2026-08-20', '2026-10-15', 'usr-pm-asad', 'usr-fahad'),
          ('pp-hr-agent', 'prog-qarc', 'HR Agent', 'Enterprise Workflow Automation', 'Autonomous HR Candidate Workflows', '5-stage autonomous hiring pipelines and screening.', 'In Progress', 'Medium', '2026-08-20', '2026-09-25', 'usr-pm-asad', 'usr-khizra'),
          ('pp-freight', 'prog-qarc', 'AI Freight Forwarding Lifecycle', 'Logistics & Commercial AI', 'Autonomous Logistics Operations & Finance Engine', '8-phase commercial freight engine with multi-agent orchestration.', 'In Progress', 'High', '2026-09-01', '2026-11-15', 'usr-pm-asad', 'usr-hiba'),
          ('pp-ai-tutor', 'prog-qarc', 'AI Tutor', 'Conversational AI & Avatars', 'Talking Head Avatar & Real-time Voice Tutor', 'SadTalker, XTTS-v2 voice cloning, and Silero VAD interactive tutor.', 'In Progress', 'High', '2026-08-01', '2026-10-10', 'usr-pm-asad', 'usr-kinjal'),
          ('pp-uae-voice', 'prog-qarc', 'UAE Voice Model for Competition', 'Arabic Speech AI & Voice Synthesis', 'Emirati Dialect Competitive Neural Voice AI', 'Specialized Emirati Arabic neural voice synthesis, dialectal acoustic modeling, and latency optimization.', 'Unassigned', 'High', '2026-08-25', '2026-10-30', 'usr-pm-asad', NULL),
          ('pp-axiom', 'prog-qarc', 'Axiom', 'Formal Reasoning & Neural-Symbolic AI', 'Automated Mathematical Proof & Logic Engine', 'Neural-symbolic theorem prover, automated code invariant generation, and formal verification solvers.', 'Unassigned', 'High', '2026-08-20', '2026-11-15', 'usr-pm-asad', NULL),
          ('pp-ecommerce-agent', 'prog-qarc', 'Ecommerce Agent', 'Autonomous Commerce & Conversational Selling', 'Autonomous Multi-Channel Shopping & Cart Agent', 'Dynamic product catalog search, real-time inventory sync, intelligent recommendations, and headless cart.', 'Unassigned', 'High', '2026-08-22', '2026-10-25', 'usr-pm-asad', NULL),
          ('pp-embassy-reachout', 'prog-qarc', 'Embassy Reach out', 'Diplomatic Intelligence & Automated Outreach', 'Autonomous Diplomatic Communications & Partner Engagement', 'Automated diplomatic stakeholder mapping, bilateral protocol compliance, and customized outreach pipelines.', 'Unassigned', 'Medium', '2026-08-28', '2026-11-20', 'usr-pm-asad', NULL),
          ('pp-retina-scan', 'prog-qarc', 'Retina Scan Early Disease Detection', 'Medical Imaging & Diagnostic AI', 'Deep Learning Fundus Image Pathology Classification', 'High-resolution retinal fundus photography analysis using CNN-ViT for diabetic retinopathy & glaucoma detection.', 'Unassigned', 'High', '2026-08-15', '2026-10-31', 'usr-pm-asad', NULL),
          ('pp-fmd-detection', 'prog-qarc', 'Foot and Mouth Disease (FMD) Detection in Animals', 'Veterinary Computer Vision & Edge Diagnostics', 'Livestock Lesion Detection & Thermal Screening Vision Pipeline', 'Multi-spectral thermal and RGB computer vision for early detection of FMD vesicular lesions in hooves and muzzles.', 'Unassigned', 'High', '2026-08-18', '2026-11-10', 'usr-pm-asad', NULL),
          ('pp-marketing-agent', 'prog-qarc', 'Marketing Agent', 'Autonomous Marketing & Growth Automation', 'Autonomous Omnichannel Campaign & Content Engine', 'Autonomous growth agent capable of market research, high-conversion copy generation, and multi-channel optimization.', 'Unassigned', 'Medium', '2026-08-25', '2026-10-20', 'usr-pm-asad', NULL),
          ('pp-pvis', 'prog-qarc', 'Pakistan Vehicle Intelligence System (PVIS)', 'Edge AI & Computer Vision', 'AI-powered vehicle monitoring system', 'Detects vehicles, reads Pakistani license plates using OCR, tracks entry/exit sessions, stores data locally on Jetson Nano, and syncs everything live to a cloud dashboard.', 'Completed', 'High', '2026-08-01', '2026-08-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-track-trace', 'prog-qarc', 'M&S Aviators: Track & Trace', 'Logistics & Automation', 'Automated AWB Scraper & Emails', 'Custom full-stack app automating Ethiopian Airlines Cargo AWB tracking via Playwright.', 'Completed', 'High', '2026-08-21', '2026-09-04', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-pia-cargospot', 'prog-qarc', 'PIA CargoSpot Automation', 'Logistics & Automation', 'Async Cargo Flight Polling Bot', 'Custom full-stack app automating PIA Cargo AWB tracking via Playwright.', 'Completed', 'High', '2026-09-01', '2026-09-15', 'usr-pm-asad', 'usr-pm-asad')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          domain = EXCLUDED.domain,
          status = EXCLUDED.status,
          assigned_to = EXCLUDED.assigned_to;
      `);

      // Seed project_members
      await client.query(`
        INSERT INTO project_members (id, project_id, user_id, role)
        VALUES
          ('pm-vs-1', 'proj-voicescribe', 'usr-pm-asad', 'Project Manager'),
          ('pm-vs-2', 'proj-voicescribe', 'usr-ajiya', 'AI Pipeline Lead'),
          ('pm-vs-3', 'proj-voicescribe', 'usr-khizra', 'Backend Engineer'),
          ('pm-vs-4', 'proj-voicescribe', 'usr-fahad', 'Diarization Specialist'),
          
          ('pm-fa-1', 'proj-fishery', 'usr-pm-asad', 'Project Manager'),
          ('pm-fa-2', 'proj-fishery', 'usr-fahad', 'Vision & Edge Lead'),

          ('pm-hr-1', 'proj-hr-agent', 'usr-pm-asad', 'Project Manager'),
          ('pm-hr-2', 'proj-hr-agent', 'usr-khizra', 'Workflow Lead'),

          ('pm-ff-1', 'proj-freight', 'usr-pm-asad', 'Project Manager'),
          ('pm-ff-2', 'proj-freight', 'usr-ajiya', 'Commercial Lead'),
          ('pm-ff-3', 'proj-freight', 'usr-hiba', 'Backend & Automation Lead'),
          ('pm-ff-4', 'proj-freight', 'usr-kinjal', 'Operations & Compliance Lead'),
          ('pm-ff-5', 'proj-freight', 'usr-khizra', 'Agents Specialist'),

          ('pm-at-1', 'proj-ai-tutor', 'usr-pm-asad', 'Project Manager'),
          ('pm-at-2', 'proj-ai-tutor', 'usr-ajiya', 'Avatar & Voice Lead'),
          ('pm-at-3', 'proj-ai-tutor', 'usr-kinjal', 'RAG & Audio Pipeline Lead'),

          ('pm-uv-1', 'proj-uae-voice', 'usr-pm-asad', 'Project Manager'),
          ('pm-ax-1', 'proj-axiom', 'usr-pm-asad', 'Project Manager'),
          ('pm-ea-1', 'proj-ecommerce-agent', 'usr-pm-asad', 'Project Manager'),
          ('pm-er-1', 'proj-embassy-reachout', 'usr-pm-asad', 'Project Manager'),
          ('pm-rs-1', 'proj-retina-scan', 'usr-pm-asad', 'Project Manager'),
          ('pm-fm-1', 'proj-fmd-detection', 'usr-pm-asad', 'Project Manager'),
          ('pm-ma-1', 'proj-marketing-agent', 'usr-pm-asad', 'Project Manager'),
          ('pm-pvis-1', 'proj-pvis', 'usr-pm-asad', 'Project Manager'),
          ('pm-tt-1', 'proj-track-trace', 'usr-pm-asad', 'Project Manager'),
          ('pm-pia-cs-1', 'proj-pia-cargospot', 'usr-pm-asad', 'Project Manager')
        ON CONFLICT (id) DO NOTHING;
      `);

            // Seed PVIS Tasks
      await client.query(`
        INSERT INTO tasks (id, name, description, status, priority, start_date, due_date, project_id, assignee_id, assigned_to, created_by, completed_at)
        VALUES 
          ('tsk-pvis-1', 'Set up camera hardware for video capture', 'Completed task: Set up camera hardware for video capture', 'Completed', 'High', '2026-08-01', '2026-08-01', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-01 23:59:59'),
          ('tsk-pvis-2', 'Record IN gate footage (daylight)', 'Completed task: Record IN gate footage (daylight)', 'Completed', 'High', '2026-08-01', '2026-08-01', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-01 23:59:59'),
          ('tsk-pvis-3', 'Record IN gate footage (night/low light)', 'Completed task: Record IN gate footage (night/low light)', 'Completed', 'High', '2026-08-01', '2026-08-01', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-01 23:59:59'),
          ('tsk-pvis-4', 'Record OUT gate footage', 'Completed task: Record OUT gate footage', 'Completed', 'High', '2026-08-01', '2026-08-01', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-01 23:59:59'),
          ('tsk-pvis-5', 'Write script to extract 1 frame per second', 'Completed task: Write script to extract 1 frame per second', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-6', 'Filter out blurry and redundant frames', 'Completed task: Filter out blurry and redundant frames', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-7', 'Organize dataset directory structure', 'Completed task: Organize dataset directory structure', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-8', 'Label car bounding boxes in YOLO format', 'Completed task: Label car bounding boxes in YOLO format', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-9', 'Label truck bounding boxes in YOLO format', 'Completed task: Label truck bounding boxes in YOLO format', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-10', 'Label bus/motorcycle bounding boxes', 'Completed task: Label bus/motorcycle bounding boxes', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-11', 'Export final dataset zip (pvis_dataset_v1)', 'Completed task: Export final dataset zip (pvis_dataset_v1)', 'Completed', 'High', '2026-08-02', '2026-08-02', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-02 23:59:59'),
          ('tsk-pvis-12', 'Initialize PyTorch environment for YOLOv5', 'Completed task: Initialize PyTorch environment for YOLOv5', 'Completed', 'High', '2026-08-03', '2026-08-03', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-03 23:59:59'),
          ('tsk-pvis-13', 'Load YOLOv5s from torch.hub (v6.2 branch)', 'Completed task: Load YOLOv5s from torch.hub (v6.2 branch)', 'Completed', 'High', '2026-08-03', '2026-08-03', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-03 23:59:59'),
          ('tsk-pvis-14', 'Bypass interactive PyTorch Hub prompt', 'Completed task: Bypass interactive PyTorch Hub prompt', 'Completed', 'High', '2026-08-03', '2026-08-03', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-03 23:59:59'),
          ('tsk-pvis-15', 'Configure YOLO detection thresholds', 'Completed task: Configure YOLO detection thresholds', 'Completed', 'High', '2026-08-03', '2026-08-03', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-03 23:59:59'),
          ('tsk-pvis-16', 'Integrate EasyOCR for license plate reading', 'Completed task: Integrate EasyOCR for license plate reading', 'Completed', 'High', '2026-08-04', '2026-08-04', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-04 23:59:59'),
          ('tsk-pvis-17', 'Implement dynamic crop regions for cars', 'Completed task: Implement dynamic crop regions for cars', 'Completed', 'High', '2026-08-04', '2026-08-04', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-04 23:59:59'),
          ('tsk-pvis-18', 'Implement dynamic crop regions for trucks/buses', 'Completed task: Implement dynamic crop regions for trucks/buses', 'Completed', 'High', '2026-08-04', '2026-08-04', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-04 23:59:59'),
          ('tsk-pvis-19', 'Implement dynamic crop regions for motorcycles', 'Completed task: Implement dynamic crop regions for motorcycles', 'Completed', 'High', '2026-08-04', '2026-08-04', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-04 23:59:59'),
          ('tsk-pvis-20', 'Add image upscaling before passing to OCR', 'Completed task: Add image upscaling before passing to OCR', 'Completed', 'High', '2026-08-05', '2026-08-05', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-05 23:59:59'),
          ('tsk-pvis-21', 'Implement custom IOU Tracker algorithm', 'Completed task: Implement custom IOU Tracker algorithm', 'Completed', 'High', '2026-08-05', '2026-08-05', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-05 23:59:59'),
          ('tsk-pvis-22', 'Assign unique persistent track IDs', 'Completed task: Assign unique persistent track IDs', 'Completed', 'High', '2026-08-05', '2026-08-05', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-05 23:59:59'),
          ('tsk-pvis-23', 'Add 2-second debounce logic', 'Completed task: Add 2-second debounce logic', 'Completed', 'High', '2026-08-06', '2026-08-06', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-06 23:59:59'),
          ('tsk-pvis-24', 'Implement bbox aspect ratio filters (0.3-3.5)', 'Completed task: Implement bbox aspect ratio filters (0.3-3.5)', 'Completed', 'High', '2026-08-06', '2026-08-06', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-06 23:59:59'),
          ('tsk-pvis-25', 'Design 3-Thread Architecture', 'Completed task: Design 3-Thread Architecture', 'Completed', 'High', '2026-08-07', '2026-08-07', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-07 23:59:59'),
          ('tsk-pvis-26', 'Implement Producer thread (camera read)', 'Completed task: Implement Producer thread (camera read)', 'Completed', 'High', '2026-08-07', '2026-08-07', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-07 23:59:59'),
          ('tsk-pvis-27', 'Implement MOG2 motion detection', 'Completed task: Implement MOG2 motion detection', 'Completed', 'High', '2026-08-07', '2026-08-07', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-07 23:59:59'),
          ('tsk-pvis-28', 'Add 60-second post-roll logic', 'Completed task: Add 60-second post-roll logic', 'Completed', 'High', '2026-08-08', '2026-08-08', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-08 23:59:59'),
          ('tsk-pvis-29', 'Implement Consumer thread (YOLO inference)', 'Completed task: Implement Consumer thread (YOLO inference)', 'Completed', 'High', '2026-08-08', '2026-08-08', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-08 23:59:59'),
          ('tsk-pvis-30', 'Create dynamic gate line detection', 'Completed task: Create dynamic gate line detection', 'Completed', 'High', '2026-08-08', '2026-08-08', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-08 23:59:59'),
          ('tsk-pvis-31', 'Implement OCR Worker thread', 'Completed task: Implement OCR Worker thread', 'Completed', 'High', '2026-08-09', '2026-08-09', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-pvis-32', 'Force MJPG codec & 640x480 resolution', 'Completed task: Force MJPG codec & 640x480 resolution', 'Completed', 'High', '2026-08-09', '2026-08-09', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-pvis-33', 'Create SQLite schema for vehicle_events', 'Completed task: Create SQLite schema for vehicle_events', 'Completed', 'High', '2026-08-09', '2026-08-09', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-pvis-34', 'Implement db_manager.py for SQLite', 'Completed task: Implement db_manager.py for SQLite', 'Completed', 'High', '2026-08-10', '2026-08-10', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-10 23:59:59'),
          ('tsk-pvis-35', 'Build storage_manager.py for SD temp recording', 'Completed task: Build storage_manager.py for SD temp recording', 'Completed', 'High', '2026-08-10', '2026-08-10', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-10 23:59:59'),
          ('tsk-pvis-36', 'Logic to move MP4 clips to external HDD', 'Completed task: Logic to move MP4 clips to external HDD', 'Completed', 'High', '2026-08-10', '2026-08-10', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-10 23:59:59'),
          ('tsk-pvis-37', 'Auto-cut video files after 1-hour limit', 'Completed task: Auto-cut video files after 1-hour limit', 'Completed', 'High', '2026-08-10', '2026-08-10', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-10 23:59:59'),
          ('tsk-pvis-38', 'Setup Flask app (port 5000) on Jetson', 'Completed task: Setup Flask app (port 5000) on Jetson', 'Completed', 'High', '2026-08-11', '2026-08-11', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-11 23:59:59'),
          ('tsk-pvis-39', 'Create MJPEG streaming routes', 'Completed task: Create MJPEG streaming routes', 'Completed', 'High', '2026-08-11', '2026-08-11', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-11 23:59:59'),
          ('tsk-pvis-40', 'Build HTML UI with live stats cards', 'Completed task: Build HTML UI with live stats cards', 'Completed', 'High', '2026-08-11', '2026-08-11', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-11 23:59:59'),
          ('tsk-pvis-41', 'Implement start/stop pipeline APIs controls', 'Completed task: Implement start/stop pipeline APIs controls', 'Completed', 'High', '2026-08-12', '2026-08-12', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-12 23:59:59'),
          ('tsk-pvis-42', 'Add video uploader panel for testing', 'Completed task: Add video uploader panel for testing', 'Completed', 'High', '2026-08-12', '2026-08-12', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-12 23:59:59'),
          ('tsk-pvis-43', 'Initialize FastAPI cloud backend app', 'Completed task: Initialize FastAPI cloud backend app', 'Completed', 'High', '2026-08-13', '2026-08-13', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-13 23:59:59'),
          ('tsk-pvis-44', 'Setup Neon PostgreSQL & SQLAlchemy models', 'Completed task: Setup Neon PostgreSQL & SQLAlchemy models', 'Completed', 'High', '2026-08-13', '2026-08-13', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-13 23:59:59'),
          ('tsk-pvis-45', 'Create POST /api/v1/sync/events endpoint', 'Completed task: Create POST /api/v1/sync/events endpoint', 'Completed', 'High', '2026-08-13', '2026-08-13', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-13 23:59:59'),
          ('tsk-pvis-46', 'Create POST /api/v1/sync/sessions endpoint', 'Completed task: Create POST /api/v1/sync/sessions endpoint', 'Completed', 'High', '2026-08-14', '2026-08-14', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-14 23:59:59'),
          ('tsk-pvis-47', 'Create GET analytics and reporting endpoints', 'Completed task: Create GET analytics and reporting endpoints', 'Completed', 'High', '2026-08-14', '2026-08-14', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-14 23:59:59'),
          ('tsk-pvis-48', 'Configure Railway deployment (port 8080)', 'Completed task: Configure Railway deployment (port 8080)', 'Completed', 'High', '2026-08-14', '2026-08-14', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-14 23:59:59'),
          ('tsk-pvis-49', 'Initialize Next.js project for Vercel', 'Completed task: Initialize Next.js project for Vercel', 'Completed', 'High', '2026-08-15', '2026-08-15', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-15 23:59:59'),
          ('tsk-pvis-50', 'Build live vehicle event feed component', 'Completed task: Build live vehicle event feed component', 'Completed', 'High', '2026-08-15', '2026-08-15', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-15 23:59:59'),
          ('tsk-pvis-51', 'Build real-time analytics charts', 'Completed task: Build real-time analytics charts', 'Completed', 'High', '2026-08-16', '2026-08-16', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-16 23:59:59'),
          ('tsk-pvis-52', 'Integrate date and plate number filters', 'Completed task: Integrate date and plate number filters', 'Completed', 'High', '2026-08-16', '2026-08-16', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-16 23:59:59'),
          ('tsk-pvis-53', 'Build background cloud sync daemon', 'Completed task: Build background cloud sync daemon', 'Completed', 'High', '2026-08-17', '2026-08-17', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-17 23:59:59'),
          ('tsk-pvis-54', 'Implement offline-first queueing mechanism', 'Completed task: Implement offline-first queueing mechanism', 'Completed', 'High', '2026-08-17', '2026-08-17', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-17 23:59:59'),
          ('tsk-pvis-55', 'Write sync_historical.py for bulk recovery', 'Completed task: Write sync_historical.py for bulk recovery', 'Completed', 'High', '2026-08-18', '2026-08-18', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-18 23:59:59'),
          ('tsk-pvis-56', 'Configure 4GB swap file for OOM prevention', 'Completed task: Configure 4GB swap file for OOM prevention', 'Completed', 'High', '2026-08-19', '2026-08-19', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-19 23:59:59'),
          ('tsk-pvis-57', 'Disable Jetson desktop GUI for RAM savings', 'Completed task: Disable Jetson desktop GUI for RAM savings', 'Completed', 'High', '2026-08-19', '2026-08-19', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-19 23:59:59'),
          ('tsk-pvis-58', 'Set torch.set_num_threads(2)', 'Completed task: Set torch.set_num_threads(2)', 'Completed', 'High', '2026-08-19', '2026-08-19', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-19 23:59:59'),
          ('tsk-pvis-59', 'Inject mock seaborn module to fix crashes', 'Completed task: Inject mock seaborn module to fix crashes', 'Completed', 'High', '2026-08-19', '2026-08-19', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-19 23:59:59'),
          ('tsk-pvis-60', 'Unpin psycopg2 version for Py3.13', 'Completed task: Unpin psycopg2 version for Py3.13', 'Completed', 'High', '2026-08-19', '2026-08-19', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-19 23:59:59'),
          ('tsk-pvis-61', 'Write install_jetson.sh setup script', 'Completed task: Write install_jetson.sh setup script', 'Completed', 'High', '2026-08-20', '2026-08-20', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-20 23:59:59'),
          ('tsk-pvis-62', 'Create systemd pvis.service file', 'Completed task: Create systemd pvis.service file', 'Completed', 'High', '2026-08-20', '2026-08-20', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-20 23:59:59'),
          ('tsk-pvis-63', 'Configure auto-start and crash recovery', 'Completed task: Configure auto-start and crash recovery', 'Completed', 'High', '2026-08-20', '2026-08-20', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-20 23:59:59'),
          ('tsk-pvis-64', 'Push final code to GitHub repo', 'Completed task: Push final code to GitHub repo', 'Completed', 'High', '2026-08-20', '2026-08-20', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-20 23:59:59'),
          ('tsk-pvis-65', 'Final end-to-end integration test', 'Completed task: Final end-to-end integration test', 'Completed', 'High', '2026-08-20', '2026-08-20', 'proj-pvis', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-20 23:59:59'),
          ('tsk-tt-1', 'Initialize Project Structure for frontend and backend', 'Completed task: Initialize Project Structure for frontend and backend', 'Completed', 'High', '2026-08-21', '2026-08-21', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-21 23:59:59'),
          ('tsk-tt-2', 'Set up Vite + React + TypeScript frontend scaffold', 'Completed task: Set up Vite + React + TypeScript frontend scaffold', 'Completed', 'High', '2026-08-21', '2026-08-21', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-21 23:59:59'),
          ('tsk-tt-3', 'Set up FastAPI + Python 3 backend scaffold', 'Completed task: Set up FastAPI + Python 3 backend scaffold', 'Completed', 'High', '2026-08-21', '2026-08-21', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-21 23:59:59'),
          ('tsk-tt-4', 'Write initial docker-compose.yml for PostgreSQL 16', 'Completed task: Write initial docker-compose.yml for PostgreSQL 16', 'Completed', 'High', '2026-08-21', '2026-08-21', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-21 23:59:59'),
          ('tsk-tt-5', 'Configure asyncpg database connection string', 'Completed task: Configure asyncpg database connection string', 'Completed', 'High', '2026-08-21', '2026-08-21', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-21 23:59:59'),
          ('tsk-tt-6', 'Build SQLAlchemy async session engine (database.py)', 'Completed task: Build SQLAlchemy async session engine (database.py)', 'Completed', 'High', '2026-08-21', '2026-08-21', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-21 23:59:59'),
          ('tsk-tt-7', 'Create AWBShipment relational schema', 'Completed task: Create AWBShipment relational schema', 'Completed', 'High', '2026-08-22', '2026-08-22', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-22 23:59:59'),
          ('tsk-tt-8', 'Create AWBEvent historical timeline schema', 'Completed task: Create AWBEvent historical timeline schema', 'Completed', 'High', '2026-08-22', '2026-08-22', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-22 23:59:59'),
          ('tsk-tt-9', 'Create StatusChange audit trail schema', 'Completed task: Create StatusChange audit trail schema', 'Completed', 'High', '2026-08-22', '2026-08-22', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-22 23:59:59'),
          ('tsk-tt-10', 'Create Alert system internal schema', 'Completed task: Create Alert system internal schema', 'Completed', 'High', '2026-08-22', '2026-08-22', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-22 23:59:59'),
          ('tsk-tt-11', 'Generate initial Alembic migrations for DB', 'Completed task: Generate initial Alembic migrations for DB', 'Completed', 'High', '2026-08-22', '2026-08-22', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-22 23:59:59'),
          ('tsk-tt-12', 'Install and configure Microsoft Playwright', 'Completed task: Install and configure Microsoft Playwright', 'Completed', 'High', '2026-08-23', '2026-08-23', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-23 23:59:59'),
          ('tsk-tt-13', 'Build headless browser initialization logic', 'Completed task: Build headless browser initialization logic', 'Completed', 'High', '2026-08-23', '2026-08-23', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-23 23:59:59'),
          ('tsk-tt-14', 'Write navigation sequence for Ethiopian Airlines portal', 'Completed task: Write navigation sequence for Ethiopian Airlines portal', 'Completed', 'High', '2026-08-23', '2026-08-23', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-23 23:59:59'),
          ('tsk-tt-15', 'Bypass initial cookie/consent popups on portal', 'Completed task: Bypass initial cookie/consent popups on portal', 'Completed', 'High', '2026-08-23', '2026-08-23', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-23 23:59:59'),
          ('tsk-tt-16', 'Engineer DOM selectors for raw AWB text extraction', 'Completed task: Engineer DOM selectors for raw AWB text extraction', 'Completed', 'High', '2026-08-24', '2026-08-24', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-tt-17', 'Extract flight legs and routing tables from DOM', 'Completed task: Extract flight legs and routing tables from DOM', 'Completed', 'High', '2026-08-24', '2026-08-24', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-tt-18', 'Extract event history tables into structured JSON', 'Completed task: Extract event history tables into structured JSON', 'Completed', 'High', '2026-08-24', '2026-08-24', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-tt-19', 'Build change_detector.py to compare against DB snapshot', 'Completed task: Build change_detector.py to compare against DB snapshot', 'Completed', 'High', '2026-08-25', '2026-08-25', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-tt-20', 'Develop algorithm to identify new flight legs', 'Completed task: Develop algorithm to identify new flight legs', 'Completed', 'High', '2026-08-25', '2026-08-25', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-tt-21', 'Develop algorithm to detect status shifts', 'Completed task: Develop algorithm to detect status shifts', 'Completed', 'High', '2026-08-25', '2026-08-25', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-tt-22', 'Implement adaptive polling interval logic', 'Completed task: Implement adaptive polling interval logic', 'Completed', 'High', '2026-08-25', '2026-08-25', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-tt-23', 'Configure Immediate/Fast/Normal/Slow/Daily tiers', 'Completed task: Configure Immediate/Fast/Normal/Slow/Daily tiers', 'Completed', 'High', '2026-08-25', '2026-08-25', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-tt-24', 'Build scheduler.py async worker loop', 'Completed task: Build scheduler.py async worker loop', 'Completed', 'High', '2026-08-26', '2026-08-26', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-26 23:59:59'),
          ('tsk-tt-25', 'Integrate scheduler with FastAPI lifecycle events', 'Completed task: Integrate scheduler with FastAPI lifecycle events', 'Completed', 'High', '2026-08-26', '2026-08-26', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-26 23:59:59'),
          ('tsk-tt-26', 'Add asyncio.Semaphore to limit simultaneous scrapes', 'Completed task: Add asyncio.Semaphore to limit simultaneous scrapes', 'Completed', 'High', '2026-08-26', '2026-08-26', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-26 23:59:59'),
          ('tsk-tt-27', 'Test memory consumption under heavy load', 'Completed task: Test memory consumption under heavy load', 'Completed', 'High', '2026-08-26', '2026-08-26', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-26 23:59:59'),
          ('tsk-tt-28', 'Debug SQLAlchemy lazy-load errors in background tasks', 'Completed task: Debug SQLAlchemy lazy-load errors in background tasks', 'Completed', 'High', '2026-08-27', '2026-08-27', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-tt-29', 'Refactor queries to use selectinload for eager loading', 'Completed task: Refactor queries to use selectinload for eager loading', 'Completed', 'High', '2026-08-27', '2026-08-27', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-tt-30', 'Write unit tests for the worker loop', 'Completed task: Write unit tests for the worker loop', 'Completed', 'High', '2026-08-27', '2026-08-27', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-tt-31', 'Transition from Gmail API to generic SMTP lib', 'Completed task: Transition from Gmail API to generic SMTP lib', 'Completed', 'High', '2026-08-28', '2026-08-28', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-tt-32', 'Configure SSL over Port 465 for operations@gsaetcargo.com.pk', 'Completed task: Configure SSL over Port 465 for operations@gsaetcargo.com.pk', 'Completed', 'High', '2026-08-28', '2026-08-28', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-tt-33', 'Design responsive HTML email template', 'Completed task: Design responsive HTML email template', 'Completed', 'High', '2026-08-28', '2026-08-28', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-tt-34', 'Inject dynamic variables into HTML template', 'Completed task: Inject dynamic variables into HTML template', 'Completed', 'High', '2026-08-28', '2026-08-28', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-tt-35', 'Wire scheduler to trigger emails on status changes', 'Completed task: Wire scheduler to trigger emails on status changes', 'Completed', 'High', '2026-08-29', '2026-08-29', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-29 23:59:59'),
          ('tsk-tt-36', 'Add logic to prevent duplicate emails for the same event', 'Completed task: Add logic to prevent duplicate emails for the same event', 'Completed', 'High', '2026-08-29', '2026-08-29', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-29 23:59:59'),
          ('tsk-tt-37', 'Create isolated test_email.py mock scripts', 'Completed task: Create isolated test_email.py mock scripts', 'Completed', 'High', '2026-08-29', '2026-08-29', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-29 23:59:59'),
          ('tsk-tt-38', 'Update global app naming to ''M&S AVIATORS''', 'Completed task: Update global app naming to ''M&S AVIATORS''', 'Completed', 'High', '2026-08-30', '2026-08-30', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-30 23:59:59'),
          ('tsk-tt-39', 'Sync React dashboard palette to Deep Blue & Green', 'Completed task: Sync React dashboard palette to Deep Blue & Green', 'Completed', 'High', '2026-08-30', '2026-08-30', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-30 23:59:59'),
          ('tsk-tt-40', 'Attach M&S Aviators logo as CID inline image in emails', 'Completed task: Attach M&S Aviators logo as CID inline image in emails', 'Completed', 'High', '2026-08-30', '2026-08-30', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-30 23:59:59'),
          ('tsk-tt-41', 'Update Dashboard Header with prominent logo', 'Completed task: Update Dashboard Header with prominent logo', 'Completed', 'High', '2026-08-30', '2026-08-30', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-30 23:59:59'),
          ('tsk-tt-42', 'Build FastAPI REST routes to add/list AWBs', 'Completed task: Build FastAPI REST routes to add/list AWBs', 'Completed', 'High', '2026-08-31', '2026-08-31', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-tt-43', 'Build FastAPI route to fetch AWB histories', 'Completed task: Build FastAPI route to fetch AWB histories', 'Completed', 'High', '2026-08-31', '2026-08-31', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-tt-44', 'Create React dynamic table for active shipments', 'Completed task: Create React dynamic table for active shipments', 'Completed', 'High', '2026-08-31', '2026-08-31', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-tt-45', 'Implement expandable rows for routing breakdown', 'Completed task: Implement expandable rows for routing breakdown', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-tt-46', 'Implement expandable rows for event timeline', 'Completed task: Implement expandable rows for event timeline', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-tt-47', 'Build Add AWB sidebar form with email bindings', 'Completed task: Build Add AWB sidebar form with email bindings', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-tt-48', 'Integrate xlsx/csv batch upload parsing', 'Completed task: Integrate xlsx/csv batch upload parsing', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-tt-49', 'Create batch upload API endpoint', 'Completed task: Create batch upload API endpoint', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-tt-50', 'Add ''Manual Run'' action button in UI', 'Completed task: Add ''Manual Run'' action button in UI', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-tt-51', 'Create ScrapeLog database model', 'Completed task: Create ScrapeLog database model', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-tt-52', 'Log success/skipped/failed states in scheduler', 'Completed task: Log success/skipped/failed states in scheduler', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-tt-53', 'Create GET /api/logs route for latest 100 events', 'Completed task: Create GET /api/logs route for latest 100 events', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-tt-54', 'Build toggleable ''System Logs'' view in React UI', 'Completed task: Build toggleable ''System Logs'' view in React UI', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-tt-55', 'Evaluate Cloud VPS vs Office Server architecture', 'Completed task: Evaluate Cloud VPS vs Office Server architecture', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-tt-56', 'Document Datacenter IP block risks for Playwright', 'Completed task: Document Datacenter IP block risks for Playwright', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-tt-57', 'Setup and provision the internal Office Server', 'Completed task: Setup and provision the internal Office Server', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-tt-58', 'Write systemd service for FastAPI and Scheduler', 'Completed task: Write systemd service for FastAPI and Scheduler', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-tt-59', 'Final end-to-end handover testing', 'Completed task: Final end-to-end handover testing', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-track-trace', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-pia-cs-1', 'Initialize Python project and virtual environment', 'Completed task: Initialize Python project and virtual environment', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-pia-cs-2', 'Set up python-dotenv for secure credentials', 'Completed task: Set up python-dotenv for secure credentials', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-pia-cs-3', 'Configure PORTAL_USERNAME and PORTAL_PASSWORD in .env', 'Completed task: Configure PORTAL_USERNAME and PORTAL_PASSWORD in .env', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-pia-cs-4', 'Write read_booking_input to parse PIA_Booking.xlsx', 'Completed task: Write read_booking_input to parse PIA_Booking.xlsx', 'Completed', 'High', '2026-09-01', '2026-09-01', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-01 23:59:59'),
          ('tsk-pia-cs-5', 'Write append_results_to_excel to format and output data', 'Completed task: Write append_results_to_excel to format and output data', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-pia-cs-6', 'Configure Playwright Chromium async instance', 'Completed task: Configure Playwright Chromium async instance', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-pia-cs-7', 'Maximize viewport and set default timeouts', 'Completed task: Maximize viewport and set default timeouts', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-pia-cs-8', 'Build on_dialog automatic popup/alert dismissal handler', 'Completed task: Build on_dialog automatic popup/alert dismissal handler', 'Completed', 'High', '2026-09-02', '2026-09-02', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-02 23:59:59'),
          ('tsk-pia-cs-9', 'Write intelligent auto-login sequence', 'Completed task: Write intelligent auto-login sequence', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-pia-cs-10', 'Handle authentication state checks', 'Completed task: Handle authentication state checks', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-pia-cs-11', 'Handle login failure edge cases', 'Completed task: Handle login failure edge cases', 'Completed', 'High', '2026-09-03', '2026-09-03', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-03 23:59:59'),
          ('tsk-pia-cs-12', 'Analyze CargoSpot MooTools legacy AJAX dropdowns', 'Completed task: Analyze CargoSpot MooTools legacy AJAX dropdowns', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-pia-cs-13', 'Engineer fill_station_autocomplete logic', 'Completed task: Engineer fill_station_autocomplete logic', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-pia-cs-14', 'Wait for ul.ui-autocomplete DOM spawn events', 'Completed task: Wait for ul.ui-autocomplete DOM spawn events', 'Completed', 'High', '2026-09-04', '2026-09-04', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-04 23:59:59'),
          ('tsk-pia-cs-15', 'Handle Origin/Destination dropdown item clicks', 'Completed task: Handle Origin/Destination dropdown item clicks', 'Completed', 'High', '2026-09-05', '2026-09-05', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-05 23:59:59'),
          ('tsk-pia-cs-16', 'Create select_product_and_price_class custom injector', 'Completed task: Create select_product_and_price_class custom injector', 'Completed', 'High', '2026-09-05', '2026-09-05', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-05 23:59:59'),
          ('tsk-pia-cs-17', 'Dispatch pure JavaScript DOM events (createEvent HTMLEvents)', 'Completed task: Dispatch pure JavaScript DOM events (createEvent HTMLEvents)', 'Completed', 'High', '2026-09-05', '2026-09-05', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-05 23:59:59'),
          ('tsk-pia-cs-18', 'Force selection of SEA FOOD bypassing UI glitches', 'Completed task: Force selection of SEA FOOD bypassing UI glitches', 'Completed', 'High', '2026-09-05', '2026-09-05', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-05 23:59:59'),
          ('tsk-pia-cs-19', 'Build set_departure_date instant injection logic', 'Completed task: Build set_departure_date instant injection logic', 'Completed', 'High', '2026-09-06', '2026-09-06', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-06 23:59:59'),
          ('tsk-pia-cs-20', 'Dispatch input, change, and blur events on date fields', 'Completed task: Dispatch input, change, and blur events on date fields', 'Completed', 'High', '2026-09-06', '2026-09-06', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-06 23:59:59'),
          ('tsk-pia-cs-21', 'Read AWB, Commodity, Pieces, Weight from Excel', 'Completed task: Read AWB, Commodity, Pieces, Weight from Excel', 'Completed', 'High', '2026-09-07', '2026-09-07', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-07 23:59:59'),
          ('tsk-pia-cs-22', 'Program smart form pre-filling on the first loop iteration', 'Completed task: Program smart form pre-filling on the first loop iteration', 'Completed', 'High', '2026-09-07', '2026-09-07', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-07 23:59:59'),
          ('tsk-pia-cs-23', 'Replace Playwright native clicks with direct JS findFlightBooking()', 'Completed task: Replace Playwright native clicks with direct JS findFlightBooking()', 'Completed', 'High', '2026-09-08', '2026-09-08', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-08 23:59:59'),
          ('tsk-pia-cs-24', 'Analyze and bypass invisible loading overlays', 'Completed task: Analyze and bypass invisible loading overlays', 'Completed', 'High', '2026-09-08', '2026-09-08', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-08 23:59:59'),
          ('tsk-pia-cs-25', 'Implement popup window memory cleanup routine', 'Completed task: Implement popup window memory cleanup routine', 'Completed', 'High', '2026-09-08', '2026-09-08', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-08 23:59:59'),
          ('tsk-pia-cs-26', 'Clear page.context.pages at the start of each cycle', 'Completed task: Clear page.context.pages at the start of each cycle', 'Completed', 'High', '2026-09-08', '2026-09-08', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-08 23:59:59'),
          ('tsk-pia-cs-27', 'Build ultra-fast polling loop replacing time.sleep', 'Completed task: Build ultra-fast polling loop replacing time.sleep', 'Completed', 'High', '2026-09-09', '2026-09-09', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-pia-cs-28', 'Poll document.readyState for millisecond accuracy', 'Completed task: Poll document.readyState for millisecond accuracy', 'Completed', 'High', '2026-09-09', '2026-09-09', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-pia-cs-29', 'Monitor DOM for routing, flight, no flights keywords', 'Completed task: Monitor DOM for routing, flight, no flights keywords', 'Completed', 'High', '2026-09-09', '2026-09-09', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-pia-cs-30', 'Build extract_flight_rows HTML table parser', 'Completed task: Build extract_flight_rows HTML table parser', 'Completed', 'High', '2026-09-09', '2026-09-09', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-pia-cs-31', 'Extract flight numbers, routing, departure times, prices', 'Completed task: Extract flight numbers, routing, departure times, prices', 'Completed', 'High', '2026-09-10', '2026-09-10', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-10 23:59:59'),
          ('tsk-pia-cs-32', 'Develop is_direct_flight multi-signal verification engine', 'Completed task: Develop is_direct_flight multi-signal verification engine', 'Completed', 'High', '2026-09-10', '2026-09-10', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-10 23:59:59'),
          ('tsk-pia-cs-33', 'Analyze flight segments, aircraft counts, Stops Where text', 'Completed task: Analyze flight segments, aircraft counts, Stops Where text', 'Completed', 'High', '2026-09-10', '2026-09-10', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-10 23:59:59'),
          ('tsk-pia-cs-34', 'Output Direct flights as green in Excel', 'Completed task: Output Direct flights as green in Excel', 'Completed', 'High', '2026-09-10', '2026-09-10', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-10 23:59:59'),
          ('tsk-pia-cs-35', 'Output Transit flights as red in Excel', 'Completed task: Output Transit flights as red in Excel', 'Completed', 'High', '2026-09-10', '2026-09-10', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-10 23:59:59'),
          ('tsk-pia-cs-36', 'Build Unlimited Single Date Mode continuous loop', 'Completed task: Build Unlimited Single Date Mode continuous loop', 'Completed', 'High', '2026-09-11', '2026-09-11', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-11 23:59:59'),
          ('tsk-pia-cs-37', 'Optimize memory for high-speed narrow booking windows', 'Completed task: Optimize memory for high-speed narrow booking windows', 'Completed', 'High', '2026-09-11', '2026-09-11', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-11 23:59:59'),
          ('tsk-pia-cs-38', 'Build Date Range Mode with automatic incrementation', 'Completed task: Build Date Range Mode with automatic incrementation', 'Completed', 'High', '2026-09-11', '2026-09-11', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-11 23:59:59'),
          ('tsk-pia-cs-39', 'Implement Friday-skipping logic in Range Mode', 'Completed task: Implement Friday-skipping logic in Range Mode', 'Completed', 'High', '2026-09-11', '2026-09-11', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-11 23:59:59'),
          ('tsk-pia-cs-40', 'Implement automatic range looping/restart logic', 'Completed task: Implement automatic range looping/restart logic', 'Completed', 'High', '2026-09-12', '2026-09-12', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-12 23:59:59'),
          ('tsk-pia-cs-41', 'Add detection for HTTP 403 Forbidden', 'Completed task: Add detection for HTTP 403 Forbidden', 'Completed', 'High', '2026-09-12', '2026-09-12', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-12 23:59:59'),
          ('tsk-pia-cs-42', 'Add detection for HTTP 429 Too Many Requests', 'Completed task: Add detection for HTTP 429 Too Many Requests', 'Completed', 'High', '2026-09-12', '2026-09-12', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-12 23:59:59'),
          ('tsk-pia-cs-43', 'Build automatic session refresher (context teardown/rebuild)', 'Completed task: Build automatic session refresher (context teardown/rebuild)', 'Completed', 'High', '2026-09-12', '2026-09-12', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-12 23:59:59'),
          ('tsk-pia-cs-44', 'Implement state restoration after rate limit resets', 'Completed task: Implement state restoration after rate limit resets', 'Completed', 'High', '2026-09-13', '2026-09-13', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-13 23:59:59'),
          ('tsk-pia-cs-45', 'Build Success Pause logic (Infinite lock on FLIGHT FOUND)', 'Completed task: Build Success Pause logic (Infinite lock on FLIGHT FOUND)', 'Completed', 'High', '2026-09-13', '2026-09-13', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-13 23:59:59'),
          ('tsk-pia-cs-46', 'Build Failure Pause logic (5.0s visual verification window)', 'Completed task: Build Failure Pause logic (5.0s visual verification window)', 'Completed', 'High', '2026-09-13', '2026-09-13', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-13 23:59:59'),
          ('tsk-pia-cs-47', 'Add instant skip if user manually closes failure window', 'Completed task: Add instant skip if user manually closes failure window', 'Completed', 'High', '2026-09-13', '2026-09-13', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-13 23:59:59'),
          ('tsk-pia-cs-48', 'Architect pia_automation.py main engine', 'Completed task: Architect pia_automation.py main engine', 'Completed', 'High', '2026-09-14', '2026-09-14', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-pia-cs-49', 'Build dashboard.py UI for launching/modifying settings', 'Completed task: Build dashboard.py UI for launching/modifying settings', 'Completed', 'High', '2026-09-14', '2026-09-14', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-pia-cs-50', 'Configure PIA_Booking.xlsx master template', 'Completed task: Configure PIA_Booking.xlsx master template', 'Completed', 'High', '2026-09-14', '2026-09-14', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-pia-cs-51', 'Setup /screenshots/ directory for automated debugging', 'Completed task: Setup /screenshots/ directory for automated debugging', 'Completed', 'High', '2026-09-14', '2026-09-14', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-pia-cs-52', 'Write automated CAPTCHA and rate limit screenshot hooks', 'Completed task: Write automated CAPTCHA and rate limit screenshot hooks', 'Completed', 'High', '2026-09-15', '2026-09-15', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-pia-cs-53', 'Final end-to-end regression testing on production portal', 'Completed task: Final end-to-end regression testing on production portal', 'Completed', 'High', '2026-09-15', '2026-09-15', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-pia-cs-54', 'Final code cleanup and dependency freeze', 'Completed task: Final code cleanup and dependency freeze', 'Completed', 'High', '2026-09-15', '2026-09-15', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-pia-cs-55', 'Deployment handover and project completion sign-off', 'Completed task: Deployment handover and project completion sign-off', 'Completed', 'High', '2026-09-15', '2026-09-15', 'proj-pia-cargospot', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad', '2026-09-15 23:59:59')
        ON CONFLICT (id) DO NOTHING;
      `);

      // Seed task submissions
      await client.query(`
        INSERT INTO task_submissions (id, task_id, user_id, link, description, version)
        VALUES
          ('sub-hr-6', 'tsk-hr-6', 'usr-khizra', 'https://github.com/qarc-ai/hr-agent/pull/19', 'HR Agent 5-stage automated workflows completed and verified with test matrix.', 1),
          ('sub-ff-9', 'tsk-ff-9', 'usr-ajiya', 'https://github.com/qarc-ai/freight-lifecycle/pull/142', '5.1 Shipment Financial Profile & Variance Engine with ledger audit API endpoints.', 1),
          ('sub-ff-12', 'tsk-ff-12', 'usr-hiba', 'https://github.com/qarc-ai/freight-lifecycle/pull/145', '5.4 Accounts Receivable with FIFO/LIFO allocation and automated dunning workflow.', 1),
          ('sub-ff-13', 'tsk-ff-13', 'usr-kinjal', 'https://github.com/qarc-ai/freight-lifecycle/pull/148', '5.5 DGR Compliance Engine with validation rules and compliance audit trail.', 1),
          ('sub-ff-29', 'tsk-ff-29', 'usr-hiba', 'https://github.com/qarc-ai/freight-lifecycle/pull/160', 'Gmail API alert dispatch integrated across all 5 automations.', 1),
          ('sub-ff-31', 'tsk-ff-31', 'usr-khizra', 'https://github.com/qarc-ai/freight-lifecycle/pull/162', 'Multi-agent output verification test suite with 100% assertions passed.', 1)
        ON CONFLICT (id) DO NOTHING;
      `);

      // Seed task work parts
      await client.query(`
        INSERT INTO task_work_parts (id, task_id, title, description, status, created_by)
        VALUES
          ('wp-vs-1', 'tsk-vs-1', 'PyTorch Audio Preprocessing Pipeline', 'Chunking, resampling to 16kHz, and VAD audio framing', 'Completed', 'usr-ajiya'),
          ('wp-vs-2', 'tsk-vs-1', 'Whisper ASR Model Benchmarking', 'Benchmarking base vs medium Whisper weights on Colab', 'Completed', 'usr-ajiya'),
          ('wp-fa-1', 'tsk-fa-2', 'YOLOv8n Freshness Detector Weight Export', 'Exported best.pt achieving 92.2% mAP50', 'Completed', 'usr-fahad'),
          ('wp-fa-2', 'tsk-fa-2', 'Fish Eye Crop Classification Model', 'Anatomical eye crop freshness classifier 95.9% mAP50', 'Completed', 'usr-fahad'),
          ('wp-at-1', 'tsk-at-3', 'Coqui XTTS-v2 Multilingual Urdu-English Reference Audio', 'Curated 20-second reference samples for voice cloning', 'Completed', 'usr-ajiya'),
          ('wp-at-2', 'tsk-at-7', 'FAISS & BM25 Hybrid Retrieval Worker', 'Combined dense vector search with sparse BM25 scoring', 'Completed', 'usr-kinjal')
        ON CONFLICT (id) DO NOTHING;
      `);

      // Seed daily updates
      await client.query(`
        INSERT INTO daily_updates (id, user_id, date, content, kpi_score)
        VALUES
          ('dup-1', 'usr-fahad', '2026-09-15', 'Worked on the Edge AI vehicle detection models. Completed the training for the YOLOv8 model and deployed the initial weights to the edge device. Fixed several bugs regarding bounding box overlap.', 8),
          ('dup-2', 'usr-ajiya', '2026-09-16', 'Implemented the new voice cloning pipeline. Resolved issues with latency. Tested the model with 5 different accents and it is working perfectly.', 9),
          ('dup-3', 'usr-khizra', '2026-09-16', 'Set up the HR agent workflow schemas. Still facing some blockers with the database migrations, but the core logic is done.', 6),
          ('dup-4', 'usr-hiba', '2026-09-17', 'Completed the backend API for the freight lifecycle. Shipped the financial ledger module. The tests are passing 100%.', 10),
          ('dup-5', 'usr-pm-asad', '2026-09-17', 'Reviewed all ongoing projects. The Edge AI team is making great progress. Implemented the new KPI tracking requirements for the UNIDO grant proposal.', 8)
        ON CONFLICT (id) DO NOTHING;
      `);

      
        // MENTORSHIP BATCH 1 INJECTION
        await client.query(`
          INSERT INTO users (id, full_name, email, role, password_hash) VALUES 
          ('usr-mentor-mahadraza', 'Mahad Raza', 'usr-mentor-mahadraza@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-farazali', 'Faraz Ali', 'usr-mentor-farazali@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-muhammadwaqarkhan', 'Muhammad Waqar Khan', 'usr-mentor-muhammadwaqarkhan@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-neelkanth', 'Neel kanth', 'usr-mentor-neelkanth@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-bilalahmed', 'Bilal Ahmed', 'usr-mentor-bilalahmed@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-shahmeermahmoodkhan', 'Shahmeer Mahmood Khan', 'usr-mentor-shahmeermahmoodkhan@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-muhammadsuffiyan', 'Muhammad Suffiyan', 'usr-mentor-muhammadsuffiyan@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-areebahaq', 'Areeba Haq', 'usr-mentor-areebahaq@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-tooba', 'Tooba', 'usr-mentor-tooba@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-muhammadsuhaib', 'Muhammad Suhaib', 'usr-mentor-muhammadsuhaib@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-abdulbasit', 'Abdul Basit', 'usr-mentor-abdulbasit@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-muhammadsohaib', 'Muhammad Sohaib', 'usr-mentor-muhammadsohaib@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-toobashaikh', 'Tooba Shaikh', 'usr-mentor-toobashaikh@qarc.ai', 'Intern', 'defaultpass'),
          ('usr-mentor-muhammadsaqibkhan', 'Muhammad Saqib Khan', 'usr-mentor-muhammadsaqibkhan@qarc.ai', 'Intern', 'defaultpass')
ON CONFLICT (id) DO NOTHING;
          INSERT INTO programs (id, name, description, start_date, end_date) VALUES ('prog-mentor-b1', 'Mentorship Program Batch 1', 'AI Mentorship Program', '2026-08-24', '2026-09-20') ON CONFLICT (id) DO NOTHING;
          INSERT INTO projects (id, name, domain, about_title, about_description, status, priority, start_date, deadline, progress, program_id, manager_id, project_manager_id, created_by) VALUES 
          ('proj-mentor-medicaresystem', 'Medicare system', 'AI Mentorship', 'Mentorship Project', 'Medicare system', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-salesagent', 'Sales Agent', 'AI Mentorship', 'Mentorship Project', 'Sales Agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-aistudentperformanceprediction', 'Ai Student Performance Prediction', 'AI Mentorship', 'Mentorship Project', 'Ai Student Performance Prediction', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-aiindustrysafetycompliancemonitor', 'Ai Industry Safety Compliance Monitor', 'AI Mentorship', 'Mentorship Project', 'Ai Industry Safety Compliance Monitor', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-agriculturecontrolsystem', 'Agriculture Control System', 'AI Mentorship', 'Mentorship Project', 'Agriculture Control System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-suspisiousactivitydetector', 'Suspisious Activity Detector', 'AI Mentorship', 'Mentorship Project', 'Suspisious Activity Detector', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-customersupportagent', 'Customer Support Agent', 'AI Mentorship', 'Mentorship Project', 'Customer Support Agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-enterpriseragagentchatbot', 'Enterprise RAG Agent (chatbot)', 'AI Mentorship', 'Mentorship Project', 'Enterprise RAG Agent (chatbot)', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-compliancerag', 'Compliance RAG', 'AI Mentorship', 'Mentorship Project', 'Compliance RAG', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-aishortcircuitdetector', 'AI Short Circuit Detector', 'AI Mentorship', 'Mentorship Project', 'AI Short Circuit Detector', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-aisuspiciousactivitydetector', 'Ai suspicious activity detector', 'AI Mentorship', 'Mentorship Project', 'Ai suspicious activity detector', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-enterpriseragagentchatbotandargpeopleintelligenceplatform', 'Enterprise RAG Agent (Chatbot) and ARG People Intelligence Platform', 'AI Mentorship', 'Mentorship Project', 'Enterprise RAG Agent (Chatbot) and ARG People Intelligence Platform', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-medicaresystem', 'Medicare System', 'AI Mentorship', 'Mentorship Project', 'Medicare System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-salesforecastingsystem', 'Sales Forecasting System', 'AI Mentorship', 'Mentorship Project', 'Sales Forecasting System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-travelplanneragent', 'Travel Planner Agent', 'AI Mentorship', 'Mentorship Project', 'Travel Planner Agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-projectmanagementsystem', 'Project Management System', 'AI Mentorship', 'Mentorship Project', 'Project Management System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-aipestdetector', 'AI PEST DETECTOR', 'AI Mentorship', 'Mentorship Project', 'AI PEST DETECTOR', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-callingagent', 'Calling agent', 'AI Mentorship', 'Mentorship Project', 'Calling agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-callingagent', 'calling agent', 'AI Mentorship', 'Mentorship Project', 'calling agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-aipestdetectoraiscprediction', 'AI PEST DETECTOR & AI SC Prediction', 'AI Mentorship', 'Mentorship Project', 'AI PEST DETECTOR & AI SC Prediction', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad'),
          ('proj-mentor-callingagent', 'CALLING AGENT', 'AI Mentorship', 'Mentorship Project', 'CALLING AGENT', 'In Progress', 'High', '2026-08-24', '2026-09-20', 50, 'prog-mentor-b1', 'usr-pm-asad', 'usr-pm-asad', 'usr-pm-asad')
ON CONFLICT (id) DO NOTHING;
          INSERT INTO program_projects (id, program_id, name, domain, about_title, about_description, status, priority, start_date, deadline, created_by, assigned_to) VALUES 
          ('pp-proj-mentor-medicaresystem', 'prog-mentor-b1', 'Medicare system', 'AI Mentorship', 'Mentorship Project', 'Medicare system', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-salesagent', 'prog-mentor-b1', 'Sales Agent', 'AI Mentorship', 'Mentorship Project', 'Sales Agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-aistudentperformanceprediction', 'prog-mentor-b1', 'Ai Student Performance Prediction', 'AI Mentorship', 'Mentorship Project', 'Ai Student Performance Prediction', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-aiindustrysafetycompliancemonitor', 'prog-mentor-b1', 'Ai Industry Safety Compliance Monitor', 'AI Mentorship', 'Mentorship Project', 'Ai Industry Safety Compliance Monitor', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-agriculturecontrolsystem', 'prog-mentor-b1', 'Agriculture Control System', 'AI Mentorship', 'Mentorship Project', 'Agriculture Control System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-suspisiousactivitydetector', 'prog-mentor-b1', 'Suspisious Activity Detector', 'AI Mentorship', 'Mentorship Project', 'Suspisious Activity Detector', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-customersupportagent', 'prog-mentor-b1', 'Customer Support Agent', 'AI Mentorship', 'Mentorship Project', 'Customer Support Agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-enterpriseragagentchatbot', 'prog-mentor-b1', 'Enterprise RAG Agent (chatbot)', 'AI Mentorship', 'Mentorship Project', 'Enterprise RAG Agent (chatbot)', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-compliancerag', 'prog-mentor-b1', 'Compliance RAG', 'AI Mentorship', 'Mentorship Project', 'Compliance RAG', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-aishortcircuitdetector', 'prog-mentor-b1', 'AI Short Circuit Detector', 'AI Mentorship', 'Mentorship Project', 'AI Short Circuit Detector', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-aisuspiciousactivitydetector', 'prog-mentor-b1', 'Ai suspicious activity detector', 'AI Mentorship', 'Mentorship Project', 'Ai suspicious activity detector', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-enterpriseragagentchatbotandargpeopleintelligenceplatform', 'prog-mentor-b1', 'Enterprise RAG Agent (Chatbot) and ARG People Intelligence Platform', 'AI Mentorship', 'Mentorship Project', 'Enterprise RAG Agent (Chatbot) and ARG People Intelligence Platform', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-medicaresystem', 'prog-mentor-b1', 'Medicare System', 'AI Mentorship', 'Mentorship Project', 'Medicare System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-salesforecastingsystem', 'prog-mentor-b1', 'Sales Forecasting System', 'AI Mentorship', 'Mentorship Project', 'Sales Forecasting System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-travelplanneragent', 'prog-mentor-b1', 'Travel Planner Agent', 'AI Mentorship', 'Mentorship Project', 'Travel Planner Agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-projectmanagementsystem', 'prog-mentor-b1', 'Project Management System', 'AI Mentorship', 'Mentorship Project', 'Project Management System', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-aipestdetector', 'prog-mentor-b1', 'AI PEST DETECTOR', 'AI Mentorship', 'Mentorship Project', 'AI PEST DETECTOR', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-callingagent', 'prog-mentor-b1', 'Calling agent', 'AI Mentorship', 'Mentorship Project', 'Calling agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-callingagent', 'prog-mentor-b1', 'calling agent', 'AI Mentorship', 'Mentorship Project', 'calling agent', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-aipestdetectoraiscprediction', 'prog-mentor-b1', 'AI PEST DETECTOR & AI SC Prediction', 'AI Mentorship', 'Mentorship Project', 'AI PEST DETECTOR & AI SC Prediction', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad'),
          ('pp-proj-mentor-callingagent', 'prog-mentor-b1', 'CALLING AGENT', 'AI Mentorship', 'Mentorship Project', 'CALLING AGENT', 'In Progress', 'High', '2026-08-24', '2026-09-20', 'usr-pm-asad', 'usr-pm-asad')
ON CONFLICT (id) DO NOTHING;
          INSERT INTO project_members (id, project_id, user_id, role) VALUES 
          ('pm-m-1', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'Intern'),
          ('pm-m-2', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'Intern'),
          ('pm-m-3', 'proj-mentor-salesagent', 'usr-mentor-neelkanth', 'Intern'),
          ('pm-m-4', 'proj-mentor-salesagent', 'usr-mentor-muhammadwaqarkhan', 'Intern'),
          ('pm-m-5', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'Intern'),
          ('pm-m-6', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'Intern'),
          ('pm-m-7', 'proj-mentor-agriculturecontrolsystem', 'usr-mentor-muhammadsuffiyan', 'Intern'),
          ('pm-m-8', 'proj-mentor-suspisiousactivitydetector', 'usr-mentor-areebahaq', 'Intern'),
          ('pm-m-9', 'proj-mentor-customersupportagent', 'usr-mentor-toobashaikh', 'Intern'),
          ('pm-m-10', 'proj-mentor-customersupportagent', 'usr-mentor-tooba', 'Intern'),
          ('pm-m-11', 'proj-mentor-enterpriseragagentchatbot', 'usr-mentor-muhammadsuhaib', 'Intern'),
          ('pm-m-12', 'proj-mentor-enterpriseragagentchatbot', 'usr-mentor-muhammadsohaib', 'Intern'),
          ('pm-m-13', 'proj-mentor-compliancerag', 'usr-mentor-abdulbasit', 'Intern'),
          ('pm-m-14', 'proj-mentor-aishortcircuitdetector', 'usr-mentor-muhammadsuffiyan', 'Intern'),
          ('pm-m-15', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'Intern'),
          ('pm-m-16', 'proj-mentor-enterpriseragagentchatbotandargpeopleintelligenceplatform', 'usr-mentor-muhammadsuhaib', 'Intern'),
          ('pm-m-17', 'proj-mentor-enterpriseragagentchatbotandargpeopleintelligenceplatform', 'usr-mentor-muhammadsohaib', 'Intern'),
          ('pm-m-18', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'Intern'),
          ('pm-m-19', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'Intern'),
          ('pm-m-20', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'Intern'),
          ('pm-m-21', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'Intern'),
          ('pm-m-22', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'Intern'),
          ('pm-m-23', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'Intern'),
          ('pm-m-24', 'proj-mentor-aipestdetector', 'usr-mentor-muhammadsuffiyan', 'Intern'),
          ('pm-m-25', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'Intern'),
          ('pm-m-26', 'proj-mentor-callingagent', 'usr-mentor-areebahaq', 'Intern'),
          ('pm-m-27', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'Intern'),
          ('pm-m-28', 'proj-mentor-aipestdetectoraiscprediction', 'usr-mentor-muhammadsuffiyan', 'Intern'),
          ('pm-m-29', 'proj-mentor-callingagent', 'usr-mentor-areebahaq', 'Intern'),
          ('pm-m-30', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'Intern')
ON CONFLICT (id) DO NOTHING;
          INSERT INTO tasks (id, name, description, status, priority, start_date, due_date, project_id, assignee_id, assigned_to, created_by, completed_at) VALUES 
          ('tsk-m-1', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-2', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-3', 'Install VS code, mySQL workbench and libraries', 'Install VS code, mySQL workbench and libraries', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-4', 'Install VS code, mySQL workbench and libraries', 'Install VS code, mySQL workbench and libraries', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-5', 'AI Health Assistant configured and development environment prepared.', 'AI Health Assistant configured and development environment prepared.', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-6', 'AI Health Assistant configured and development environment prepared.', 'AI Health Assistant configured and development environment prepared.', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-7', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-salesagent', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-8', 'Data Collection & Model Deploymnet', 'Data Collection & Model Deploymnet', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-salesagent', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-9', 'Model Deployment & Training', 'Model Deployment & Training', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-salesagent', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-10', 'Project Complete', 'Project Complete', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-salesagent', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-11', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-12', 'Fixed model accuracy issue by normalizing pose data', 'Fixed model accuracy issue by normalizing pose data', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-13', 'Dataset downloaded from Roboflow and model setup completed in Google Colab.', 'Dataset downloaded from Roboflow and model setup completed in Google Colab.', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-14', 'Debugged and rebuilt activity classifier; extended pipeline for multi-person detection', 'Debugged and rebuilt activity classifier; extended pipeline for multi-person detection', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-15', 'Worked on the multi-person activity detection system and fine-tuned false detections', 'Worked on the multi-person activity detection system and fine-tuned false detections', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-16', 'Real-time behavior model fine-tuned & false sleeping bug resolved', 'Real-time behavior model fine-tuned & false sleeping bug resolved', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-17', 'Improved phone detection accuracy and integrated MP4 sample recording', 'Improved phone detection accuracy and integrated MP4 sample recording', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-18', 'Real-time behavior model fine-tuned & tested on samples', 'Real-time behavior model fine-tuned & tested on samples', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-19', 'Dashboard Folder Restructuring', 'Dashboard Folder Restructuring', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-20', 'Live Incident Logging Verified', 'Live Incident Logging Verified', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-aistudentperformanceprediction', 'usr-mentor-bilalahmed', 'usr-mentor-bilalahmed', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-21', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-22', 'Started Model Training', 'Started Model Training', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-23', 'Evaluated Model', 'Evaluated Model', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-24', 'Model trained and tested and evaluated parameters to improve accuracy', 'Model trained and tested and evaluated parameters to improve accuracy', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-25', 'Finalized Model', 'Finalized Model', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-26', 'Annotated data and trained model on new classes', 'Annotated data and trained model on new classes', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-27', 'Prepared 3 models', 'Prepared 3 models', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-28', 'Tested Models', 'Tested Models', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-29', 'Dashboard Ready', 'Dashboard Ready', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-30', 'Dashboard Ready and checked', 'Dashboard Ready and checked', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-31', 'evaluation done', 'evaluation done', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-32', 'Tested Model', 'Tested Model', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-33', 'Checked everything', 'Checked everything', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-34', 'OCR PIPELINE', 'OCR PIPELINE', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-aiindustrysafetycompliancemonitor', 'usr-mentor-shahmeermahmoodkhan', 'usr-mentor-shahmeermahmoodkhan', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-35', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-agriculturecontrolsystem', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-36', 'Data simulation', 'Data simulation', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-agriculturecontrolsystem', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-37', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-suspisiousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-38', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-customersupportagent', 'usr-mentor-tooba', 'usr-mentor-tooba', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-39', 'Built admin dashboard and user dashboard; added file upload and agent chat feature', 'Built admin dashboard and user dashboard; added file upload and agent chat feature', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-customersupportagent', 'usr-mentor-tooba', 'usr-mentor-tooba', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-40', 'text to speech integration', 'text to speech integration', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-customersupportagent', 'usr-mentor-tooba', 'usr-mentor-tooba', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-41', 'human agent ticket and voice input', 'human agent ticket and voice input', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-customersupportagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-42', 'Support agent role + ticket queue and research', 'Support agent role + ticket queue and research', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-customersupportagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-43', 'frontend integration', 'frontend integration', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-customersupportagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-44', 'research and setup', 'research and setup', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-customersupportagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-45', 'Project Documentation and 60% Frontend Completed', 'Project Documentation and 60% Frontend Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-enterpriseragagentchatbot', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-46', 'Project Report Completed', 'Project Report Completed', 'Completed', 'Medium', '2026-08-24', '2026-08-24', 'proj-mentor-compliancerag', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-08-24 23:59:59'),
          ('tsk-m-47', 'install Python libraries and langchain', 'install Python libraries and langchain', 'Completed', 'Medium', '2026-08-25', '2026-08-25', 'proj-mentor-compliancerag', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-08-25 23:59:59'),
          ('tsk-m-48', 'Create Schema and making endpoints', 'Create Schema and making endpoints', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-compliancerag', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-49', 'AI Detection, Time-aware detection', 'AI Detection, Time-aware detection', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-aishortcircuitdetector', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-50', 'Connected the Webcam Using OpenCV and Define the Restricted Area', 'Connected the Webcam Using OpenCV and Define the Restricted Area', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-51', 'Create the Suspicious Activity Scoring System which will give alert', 'Create the Suspicious Activity Scoring System which will give alert', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-52', 'research & presentation', 'research & presentation', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-53', 'video input', 'video input', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-54', 'research on new proj', 'research on new proj', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-55', 'research and voice extraction', 'research and voice extraction', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-aisuspiciousactivitydetector', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-56', 'Insertion of pdf, excel and docs files with proper structure and Chatbot responce from those saved files. For ARG project Design the dashboard and project page.', 'Insertion of pdf, excel and docs files with proper structure and Chatbot responce from those saved files. For ARG project Design the dashboard and project page.', 'Completed', 'Medium', '2026-08-27', '2026-08-27', 'proj-mentor-enterpriseragagentchatbotandargpeopleintelligenceplatform', 'usr-mentor-muhammadsohaib', 'usr-mentor-muhammadsohaib', 'usr-pm-asad', '2026-08-27 23:59:59'),
          ('tsk-m-57', 'Ai chatbot in progress', 'Ai chatbot in progress', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-58', 'Make my own chatbot', 'Make my own chatbot', 'Completed', 'Medium', '2026-08-28', '2026-08-28', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-08-28 23:59:59'),
          ('tsk-m-59', 'chatbot initial setup', 'chatbot initial setup', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-60', 'Finalizing prompt', 'Finalizing prompt', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-61', 'intrigating api', 'intrigating api', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-62', 'Chatbot on colab', 'Chatbot on colab', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-63', 'connect apis', 'connect apis', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-64', 'chatbot in progress, created admin dashboard', 'chatbot in progress, created admin dashboard', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-65', 'created admin and doctor''s dashboard', 'created admin and doctor''s dashboard', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-66', 'half chatbot backend', 'half chatbot backend', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-67', 'trained my ai', 'trained my ai', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-68', 'backend, training bot', 'backend, training bot', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-69', 'pharmacy dashboard', 'pharmacy dashboard', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-70', 'backend almost done', 'backend almost done', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-71', 'pharmacy login', 'pharmacy login', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-72', 'backend done', 'backend done', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-73', 'trained my ai', 'trained my ai', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-74', 'presentation', 'presentation', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-75', 'presentation', 'presentation', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-76', 'presentation', 'presentation', 'Completed', 'Medium', '2026-11-09', '2026-11-09', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-11-09 23:59:59'),
          ('tsk-m-77', 'presentation', 'presentation', 'Completed', 'Medium', '2026-11-09', '2026-11-09', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-11-09 23:59:59'),
          ('tsk-m-78', 'yes', 'yes', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-79', 'yes', 'yes', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-80', 'Presentation', 'Presentation', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-medicaresystem', 'usr-mentor-mahadraza', 'usr-mentor-mahadraza', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-81', 'yes', 'yes', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-medicaresystem', 'usr-mentor-farazali', 'usr-mentor-farazali', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-82', 'Complete Project & Presentation', 'Complete Project & Presentation', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-83', 'Complete Project & Presentation', 'Complete Project & Presentation', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-84', 'Research Work & Injestion layer Complete', 'Research Work & Injestion layer Complete', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-85', 'Research Work & Injestion layer Complete', 'Research Work & Injestion layer Complete', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-86', 'Schema Detection Layer & Data Cleaning Layer', 'Schema Detection Layer & Data Cleaning Layer', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-87', 'Schema Detection Layer & Data Cleaning Layer', 'Schema Detection Layer & Data Cleaning Layer', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-88', 'Business Insights Layer, Forecasting Layer', 'Business Insights Layer, Forecasting Layer', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-89', 'Business Insights Layer, Forecasting Layer', 'Business Insights Layer, Forecasting Layer', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-90', 'Business Insights Layer, Feature Engineering, Forecasting Layer', 'Business Insights Layer, Feature Engineering, Forecasting Layer', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-91', 'Business Insights Layer, Feature Engineering, Forecasting Layer', 'Business Insights Layer, Feature Engineering, Forecasting Layer', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-92', 'Working with Prophet & SARIMA Models', 'Working with Prophet & SARIMA Models', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-93', 'Working with Prophet & SARIMA Models', 'Working with Prophet & SARIMA Models', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-94', 'Frontend Done', 'Frontend Done', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-95', 'Frontend Done', 'Frontend Done', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-96', 'Deployment Done', 'Deployment Done', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-97', 'Deployment Done', 'Deployment Done', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-98', 'presentation', 'presentation', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-99', 'presentation', 'presentation', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-100', 'presentation', 'presentation', 'Completed', 'Medium', '2026-11-09', '2026-11-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-11-09 23:59:59'),
          ('tsk-m-101', 'presentation', 'presentation', 'Completed', 'Medium', '2026-11-09', '2026-11-09', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-11-09 23:59:59'),
          ('tsk-m-102', 'Working on presenation', 'Working on presenation', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-103', 'Working on presenation', 'Working on presenation', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-104', 'Presentation', 'Presentation', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadwaqarkhan', 'usr-mentor-muhammadwaqarkhan', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-105', 'Presentation', 'Presentation', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-salesforecastingsystem', 'usr-mentor-muhammadsaqibkhan', 'usr-mentor-muhammadsaqibkhan', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-106', 'Project Setup', 'Project Setup', 'Completed', 'Medium', '2026-08-31', '2026-08-31', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-08-31 23:59:59'),
          ('tsk-m-107', 'Authentication', 'Authentication', 'Completed', 'Medium', '2026-01-09', '2026-01-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-01-09 23:59:59'),
          ('tsk-m-108', 'integration with model', 'integration with model', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-109', 'Making endpoints Of Api', 'Making endpoints Of Api', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-110', 'Working On ASGI Server', 'Working On ASGI Server', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-111', 'Finalized Project', 'Finalized Project', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-112', 'Making Presentation', 'Making Presentation', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-113', 'N.S', 'N.S', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-114', 'PFP', 'PFP', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-115', 'Presentation', 'Presentation', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-travelplanneragent', 'usr-mentor-abdulbasit', 'usr-mentor-abdulbasit', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-116', 'Project and tasks date checks. Add Tasks challenge tracker. Add User functionality in administrator portal. Report page creation.', 'Project and tasks date checks. Add Tasks challenge tracker. Add User functionality in administrator portal. Report page creation.', 'Completed', 'Medium', '2026-02-09', '2026-02-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-02-09 23:59:59'),
          ('tsk-m-117', 'Tasks file attachment and improve frontend.', 'Tasks file attachment and improve frontend.', 'Completed', 'Medium', '2026-03-09', '2026-03-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-03-09 23:59:59'),
          ('tsk-m-118', 'Improve Frontend Design, Update form roles retrieving, add team overview part in dashboard and prepare AI Agent implementation report.', 'Improve Frontend Design, Update form roles retrieving, add team overview part in dashboard and prepare AI Agent implementation report.', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-119', 'AI Agent Implementation and Improve Team page design', 'AI Agent Implementation and Improve Team page design', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-120', 'AI Agent Testing and Validation', 'AI Agent Testing and Validation', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-121', 'Prepared Program Projects Section', 'Prepared Program Projects Section', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-122', 'Prepared Program Projects Section', 'Prepared Program Projects Section', 'Completed', 'Medium', '2026-11-09', '2026-11-09', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-11-09 23:59:59'),
          ('tsk-m-123', 'Task Creation through excel file', 'Task Creation through excel file', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-124', 'Presentation', 'Presentation', 'Completed', 'Medium', '2026-09-15', '2026-09-15', 'proj-mentor-projectmanagementsystem', 'usr-mentor-muhammadsuhaib', 'usr-mentor-muhammadsuhaib', 'usr-pm-asad', '2026-09-15 23:59:59'),
          ('tsk-m-125', 'built the Pest-Risk System', 'built the Pest-Risk System', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-aipestdetector', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-126', 'software work', 'software work', 'Completed', 'Medium', '2026-07-09', '2026-07-09', 'proj-mentor-aipestdetector', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-07-09 23:59:59'),
          ('tsk-m-127', 'AI Training', 'AI Training', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-aipestdetector', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-128', 'Software Work', 'Software Work', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-aipestdetector', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-129', 'research and flux integration', 'research and flux integration', 'Completed', 'Medium', '2026-04-09', '2026-04-09', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-04-09 23:59:59'),
          ('tsk-m-130', 'voice cloning', 'voice cloning', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-callingagent', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-131', 'backend and API', 'backend and API', 'Completed', 'Medium', '2026-08-09', '2026-08-09', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-08-09 23:59:59'),
          ('tsk-m-132', 'collab environment setup , voice cloning,server deploy', 'collab environment setup , voice cloning,server deploy', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-callingagent', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-133', 'collab environment setup , voice cloning,server deploy', 'collab environment setup , voice cloning,server deploy', 'Completed', 'Medium', '2026-09-09', '2026-09-09', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-09-09 23:59:59'),
          ('tsk-m-134', 'AI trianing', 'AI trianing', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-aipestdetectoraiscprediction', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-135', 'Working on presenation', 'Working on presenation', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-aipestdetectoraiscprediction', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-136', 'yes', 'yes', 'Completed', 'Medium', '2026-09-16', '2026-09-16', 'proj-mentor-aipestdetectoraiscprediction', 'usr-mentor-muhammadsuffiyan', 'usr-mentor-muhammadsuffiyan', 'usr-pm-asad', '2026-09-16 23:59:59'),
          ('tsk-m-137', 'Env setup', 'Env setup', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-callingagent', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-138', 'Env setup', 'Env setup', 'Completed', 'Medium', '2026-10-09', '2026-10-09', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-10-09 23:59:59'),
          ('tsk-m-139', 'yes', 'yes', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-callingagent', 'usr-mentor-areebahaq', 'usr-mentor-areebahaq', 'usr-pm-asad', '2026-09-14 23:59:59'),
          ('tsk-m-140', 'yes', 'yes', 'Completed', 'Medium', '2026-09-14', '2026-09-14', 'proj-mentor-callingagent', 'usr-mentor-toobashaikh', 'usr-mentor-toobashaikh', 'usr-pm-asad', '2026-09-14 23:59:59')
  ON CONFLICT (id) DO NOTHING;
        `);
      console.log("✅ QARC Database schema & actual dataset successfully synchronized!");

    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}

if (process.env.DATABASE_URL) {
  console.log("Connecting to PostgreSQL / Neon via DATABASE_URL...");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("connect", () => {
    console.log("PostgreSQL connection established");
  });

  pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
  });

  // Run schema creation and actual seed on real PostgreSQL database
  initDatabase(pool);
} else {
  console.log("⚡ DATABASE_URL not found: Initializing Local In-Memory PostgreSQL (pg-mem)...");
  const { newDb } = require("pg-mem");
  const mem = newDb();

  // Register common pg functions
  mem.public.registerFunction({
    name: "now",
    args: [],
    returns: mem.public.getType("timestamp with time zone"),
    implementation: () => new Date(),
  });

  const pg = mem.adapters.createPg();
  pool = new pg.Pool();

  initDatabase(pool);
}

module.exports = pool;



