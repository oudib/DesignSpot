-- ============================================================================
-- Sobrus DS — full Supabase setup
-- Paste this whole file into the Supabase SQL editor and click "Run".
-- It creates the tables, then seeds the demo user + 6 solutions + sample data.
-- Safe to re-run: it drops the tables first.
-- ============================================================================

-- ---------- Reset (drop in dependency order) ----------
DROP TABLE IF EXISTS "Ticket"       CASCADE;
DROP TABLE IF EXISTS "LinearTicket" CASCADE;
DROP TABLE IF EXISTS "Design"       CASCADE;
DROP TABLE IF EXISTS "Flow"         CASCADE;
DROP TABLE IF EXISTS "Submodule" CASCADE;
DROP TABLE IF EXISTS "Module"    CASCADE;
DROP TABLE IF EXISTS "Solution"  CASCADE;
DROP TABLE IF EXISTS "User"      CASCADE;

-- ---------- Tables ----------
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'designer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#3464f6',
    "icon" TEXT NOT NULL DEFAULT '✦',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "solutionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submodule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Submodule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "submoduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinearTicket" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LinearTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "claudeUrl" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "flowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "linearUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,
    "solutionId" TEXT,
    "flowId" TEXT,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- ---------- Indexes ----------
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Solution_slug_key" ON "Solution"("slug");
CREATE UNIQUE INDEX "Module_solutionId_slug_key" ON "Module"("solutionId", "slug");
CREATE UNIQUE INDEX "Submodule_moduleId_slug_key" ON "Submodule"("moduleId", "slug");

-- ---------- Foreign keys ----------
ALTER TABLE "Module"    ADD CONSTRAINT "Module_solutionId_fkey"   FOREIGN KEY ("solutionId")  REFERENCES "Solution"("id")  ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Submodule" ADD CONSTRAINT "Submodule_moduleId_fkey"  FOREIGN KEY ("moduleId")    REFERENCES "Module"("id")    ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Flow"      ADD CONSTRAINT "Flow_submoduleId_fkey"    FOREIGN KEY ("submoduleId") REFERENCES "Submodule"("id") ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Design"       ADD CONSTRAINT "Design_flowId_fkey"        FOREIGN KEY ("flowId")      REFERENCES "Flow"("id")      ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "LinearTicket" ADD CONSTRAINT "LinearTicket_flowId_fkey"  FOREIGN KEY ("flowId")      REFERENCES "Flow"("id")      ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "Ticket"    ADD CONSTRAINT "Ticket_assigneeId_fkey"   FOREIGN KEY ("assigneeId")  REFERENCES "User"("id")      ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket"    ADD CONSTRAINT "Ticket_solutionId_fkey"   FOREIGN KEY ("solutionId")  REFERENCES "Solution"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket"    ADD CONSTRAINT "Ticket_flowId_fkey"       FOREIGN KEY ("flowId")      REFERENCES "Flow"("id")      ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Demo account → email: designer@sobrus.com  /  password: sobrus123
INSERT INTO "User" ("id","email","name","password","role","createdAt") VALUES
  ('usr_designer','designer@sobrus.com','Sobrus Designer',
   '$2a$10$c1jRTnzL/dLXt34L8oERJelH/djB96s.hMTSzOwD2b3OS3o53eiiS','admin', now());

-- The 6 solutions
INSERT INTO "Solution" ("id","name","slug","tagline","description","color","icon","order","updatedAt") VALUES
  ('sol_pharma','Sobrus Pharma','sobrus-pharma','Pharmacy management','All-in-one management software for pharmacies — sales, stock, accounting and patient care.','#1f47eb','💊',0, now()),
  ('sol_ecopara','Ecopara','ecopara','Parapharmacy e-commerce','Online parapharmacy marketplace connecting customers with trusted products.','#0ea5a3','🌿',1, now()),
  ('sol_supply','Sobrus Supply','sobrus-supply','Distribution & supply chain','B2B ordering and supply platform linking pharmacies with wholesalers and labs.','#f97316','📦',2, now()),
  ('sol_club','Sobrus Club','sobrus-club','Loyalty & community','Loyalty program and community hub rewarding engagement across the Sobrus ecosystem.','#a855f7','🎁',3, now()),
  ('sol_meds','Sobrus Meds','sobrus-meds','Medical & prescriptions','Digital tools for doctors and patients — e-prescriptions, records and teleconsultation.','#e11d48','🩺',4, now()),
  ('sol_design','Sobrus Design','sobrus-design','Design system & brand','The shared design system, components and brand guidelines powering every Sobrus product.','#0f172a','🎨',5, now());

-- Sample structure for Sobrus Pharma
INSERT INTO "Module" ("id","name","slug","order","solutionId","updatedAt") VALUES
  ('mod_sales','Sales','sales',0,'sol_pharma', now()),
  ('mod_stock','Stock','stock',1,'sol_pharma', now());

INSERT INTO "Submodule" ("id","name","slug","order","moduleId","updatedAt") VALUES
  ('sub_pos','Point of Sale','point-of-sale',0,'mod_sales', now()),
  ('sub_inv','Inventory','inventory',0,'mod_stock', now());

INSERT INTO "Flow" ("id","name","description","order","submoduleId","updatedAt") VALUES
  ('flow_newsale','New sale flow','From scanning a product to printing the receipt.',0,'sub_pos', now()),
  ('flow_refund','Refund flow','Handling product returns and refunds.',1,'sub_pos', now()),
  ('flow_count','Stock count flow','Periodic inventory counting workflow.',0,'sub_inv', now());

-- Multiple dated Linear tickets per flow (change history)
INSERT INTO "LinearTicket" ("id","url","label","date","flowId","updatedAt") VALUES
  ('lt_pha101','https://linear.app/sobrus/issue/PHA-101','Initial design','2026-01-12','flow_newsale', now()),
  ('lt_pha188','https://linear.app/sobrus/issue/PHA-188','Payment step redesign','2026-03-04','flow_newsale', now()),
  ('lt_pha102','https://linear.app/sobrus/issue/PHA-102','Initial design','2026-02-02','flow_refund', now());

INSERT INTO "Design" ("id","title","claudeUrl","variant","order","flowId","updatedAt") VALUES
  ('des_pos_main','POS — main screen','https://claude.ai/','desktop',0,'flow_newsale', now()),
  ('des_pos_pay','POS — payment modal','https://claude.ai/','v2',1,'flow_newsale', now()),
  ('des_refund','Refund — confirmation','https://claude.ai/','',0,'flow_refund', now());
