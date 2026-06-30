-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'it');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD', 'GBP', 'CHF');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "Workspace" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('super_admin', 'crm_admin', 'business_dev', 'rnd_technical', 'logistics', 'finance', 'management_readonly', 'company_owner', 'company_member', 'company_technical', 'company_logistics', 'company_finance');

-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "MfaFactorType" AS ENUM ('totp', 'webauthn', 'recovery_code');

-- CreateEnum
CREATE TYPE "MfaFactorStatus" AS ENUM ('pending', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('success', 'denied');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('queued', 'sent', 'failed', 'bounced', 'simulated_sent', 'skipped');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('submitted', 'email_verification', 'pending_approval', 'more_info_requested', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RegistrationDecisionType" AS ENUM ('approve', 'reject', 'request_more_info');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('new_registration', 'registration_decision', 'new_sample_request', 'sample_approved', 'ready_to_ship', 'shipment_dispatched', 'customs_hold', 'delivery_delay', 'delivery_confirmed', 'feedback_requested', 'feedback_submitted', 'technical_reply', 'nda_sent', 'nda_changes_requested', 'nda_signed', 'nda_expiring', 'task_due', 'task_overdue', 'support_request', 'invoice_overdue');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('distributor', 'fb_manufacturer', 'horeca', 'bakery_manufacturer', 'dairy_manufacturer', 'confectionery_manufacturer', 'ingredient_company', 'retailer', 'agency', 'laboratory', 'consultant', 'other');

-- CreateEnum
CREATE TYPE "CommercialSegment" AS ENUM ('bar_horeca', 'pasticcerie_bakeries', 'international_export', 'ecommerce_b2c', 'distributor');

-- CreateEnum
CREATE TYPE "RelationshipStage" AS ENUM ('lead', 'contacted', 'interested', 'qualified', 'nda_in_progress', 'nda_signed', 'sampling', 'testing', 'commercial_discussion', 'customer', 'repeat_customer', 'dormant', 'lost');

-- CreateEnum
CREATE TYPE "FirstContactChannel" AS ENUM ('email', 'gmail', 'referral', 'event', 'inbound_web', 'linkedin', 'phone', 'partner', 'other');

-- CreateEnum
CREATE TYPE "CooperationModel" AS ENUM ('direct', 'distribution', 'private_label', 'co_development', 'agency', 'undecided');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('micro', 'small', 'medium', 'large', 'enterprise');

-- CreateEnum
CREATE TYPE "DecisionRole" AS ENUM ('decision_maker', 'influencer', 'gatekeeper', 'champion', 'user', 'unknown');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('lead', 'contacted', 'interested', 'qualified', 'nda_to_prepare', 'nda_sent', 'nda_negotiation', 'nda_signed', 'introductory_call', 'technical_call', 'sample_requested', 'sample_approved', 'sample_shipped', 'sample_delivered', 'application_testing', 'feedback_received', 'commercial_discussion', 'quotation', 'customer', 'repeat_customer', 'on_hold', 'inactive', 'lost', 'disqualified');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('in_development', 'tested', 'launched', 'archived');

-- CreateEnum
CREATE TYPE "ApplicationCategory" AS ENUM ('dairy', 'yogurt', 'desserts', 'flavoured_milk', 'ice_cream', 'bakery', 'biscuits', 'cakes', 'croissants', 'chocolate', 'protein_bars', 'beverages', 'functional_drinks', 'coffee', 'spreads', 'sauces', 'plant_based', 'sports_nutrition', 'other');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('draft', 'submitted', 'under_review', 'more_info_required', 'approved', 'rejected', 'preparing', 'ready_to_ship', 'shipped', 'in_transit', 'customs_hold', 'delivery_attempted', 'delivered', 'receipt_confirmed', 'testing', 'feedback_requested', 'feedback_received', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('g', 'kg', 'units', 'sachets', 'boxes', 'l', 'ml');

-- CreateEnum
CREATE TYPE "CustomsStatus" AS ENUM ('not_required', 'pending', 'in_clearance', 'hold', 'cleared');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('DAP', 'DDP', 'EXW', 'CPT', 'FCA', 'CIP');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('pending', 'preparing', 'in_transit', 'delayed', 'customs_hold', 'delivered', 'delivery_confirmed', 'exception');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('received', 'under_review', 'additional_info_requested', 'technical_reply_sent', 'technical_call_needed', 'resolved');

-- CreateEnum
CREATE TYPE "FeedbackResult" AS ENUM ('positive', 'mixed', 'negative', 'inconclusive');

-- CreateEnum
CREATE TYPE "NextStep" AS ENUM ('new_sample', 'technical_call', 'reformulate', 'proceed_commercial', 'close', 'awaiting_decision');

-- CreateEnum
CREATE TYPE "FeedbackCommentVisibility" AS ENUM ('internal', 'client');

-- CreateEnum
CREATE TYPE "DevelopmentStage" AS ENUM ('concept', 'feasibility', 'prototype', 'pilot', 'pre_industrial', 'industrial', 'launched', 'on_hold');

-- CreateEnum
CREATE TYPE "TestStage" AS ENUM ('not_started', 'lab', 'bench', 'pilot_line', 'shelf_life', 'sensory_panel', 'completed');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('public', 'portal_general', 'pre_nda', 'post_nda', 'company_specific', 'internal');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('technical_data_sheet', 'safety_data_sheet', 'presentation', 'application_guide', 'price_list', 'nda', 'certificate', 'regulatory', 'marketing', 'photo', 'other');

-- CreateEnum
CREATE TYPE "NDAStatus" AS ENUM ('not_required', 'to_prepare', 'draft', 'sent', 'under_review', 'changes_requested', 'approved', 'awaiting_italprotein_signature', 'awaiting_counterparty_signature', 'partially_signed', 'fully_signed', 'expired', 'terminated');

-- CreateEnum
CREATE TYPE "NDAType" AS ENUM ('mutual', 'one_way_inbound', 'one_way_outbound');

-- CreateEnum
CREATE TYPE "DocumentAccessAction" AS ENUM ('signed_url_issued', 'viewed', 'downloaded', 'denied');

-- CreateEnum
CREATE TYPE "GoogleScope" AS ENUM ('drive_file', 'drive_metadata_readonly', 'documents', 'gmail_send');

-- CreateEnum
CREATE TYPE "GoogleTokenStatus" AS ENUM ('active', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'quoted', 'confirmed', 'invoiced', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'confirmed', 'invoiced', 'fulfilled', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bank_transfer', 'card', 'cash', 'cheque', 'other');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('follow_up', 'call', 'email', 'prepare_nda', 'prepare_sample', 'rnd_review', 'logistics', 'finance', 'meeting', 'other');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'blocked', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('manual', 'rnd_generated', 'system');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('video_call', 'phone_call', 'on_site', 'event', 'technical_call');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('email', 'call', 'meeting', 'note', 'task', 'company_status_change', 'opportunity_change', 'nda_event', 'sample_event', 'shipment_event', 'feedback', 'technical_reply', 'document', 'quote', 'order', 'invoice', 'payment', 'registration');

-- CreateEnum
CREATE TYPE "ActivityVisibility" AS ENUM ('internal', 'client');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('technical_question', 'sample_request', 'logistics_issue', 'commercial_request', 'documentation_request', 'regulatory_request', 'meeting_request', 'account_issue', 'other');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('open', 'acknowledged', 'in_progress', 'waiting_on_client', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "AssistantAudience" AS ENUM ('public', 'portal', 'internal');

-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "AssistantToolCallStatus" AS ENUM ('proposed', 'awaiting_confirmation', 'confirmed', 'executed', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "AssistantCitationTargetType" AS ENUM ('company', 'contact', 'opportunity', 'sample_request', 'shipment', 'feedback', 'application_project', 'product', 'nda', 'document', 'support_request', 'invoice', 'task', 'meeting', 'google_drive_file');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "roleId" TEXT NOT NULL,
    "kind" "UserKind" NOT NULL DEFAULT 'internal',
    "companyId" TEXT,
    "contactId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "passwordHash" TEXT,
    "mfaEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "language" "Locale" NOT NULL DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MfaFactorType" NOT NULL,
    "status" "MfaFactorStatus" NOT NULL DEFAULT 'pending',
    "label" TEXT,
    "secret" TEXT,
    "credentialId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" "RoleKey" NOT NULL,
    "kind" "RoleKind" NOT NULL,
    "name" TEXT,
    "permissions" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'submitted',
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "companyType" "CompanyType" NOT NULL,
    "companySubtype" TEXT,
    "website" TEXT,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "postalCode" TEXT,
    "vatNumber" TEXT,
    "registrationNumber" TEXT,
    "mainActivity" TEXT,
    "companySize" "CompanySize",
    "marketsServed" TEXT[],
    "preferredLanguage" "Locale" NOT NULL DEFAULT 'en',
    "preferredCurrency" "Currency" NOT NULL DEFAULT 'EUR',
    "timezone" TEXT,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "contactJobTitle" TEXT,
    "contactDepartment" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactMobile" TEXT,
    "contactLanguage" "Locale",
    "reason" TEXT,
    "existingContactPerson" TEXT,
    "intendedApplications" "ApplicationCategory"[],
    "productCategories" "ApplicationCategory"[],
    "samplesRequested" BOOLEAN,
    "intendedTerritories" TEXT[],
    "estimatedTimeline" TEXT,
    "additionalMessage" TEXT,
    "privacyAccepted" BOOLEAN NOT NULL DEFAULT false,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN,
    "linkedCompanyId" TEXT,
    "adminNote" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_decisions" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "decision" "RegistrationDecisionType" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provisionedCompanyId" TEXT,
    "provisionedContactId" TEXT,
    "provisionedOwnerUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "RoleKey",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "result" "AuditResult" NOT NULL DEFAULT 'success',
    "ip" TEXT,
    "userAgent" TEXT,
    "companyId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "trigger" "NotificationType" NOT NULL,
    "templateKey" TEXT,
    "to" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "cc" TEXT[],
    "subject" TEXT NOT NULL,
    "preview" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "status" "EmailLogStatus" NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "recipientUserId" TEXT,
    "companyId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "aliases" TEXT[],
    "type" "CompanyType" NOT NULL,
    "subtype" TEXT,
    "segment" "CommercialSegment",
    "description" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "vatNumber" TEXT,
    "registrationNumber" TEXT,
    "logoUrl" TEXT,
    "initials" TEXT NOT NULL,
    "accentColor" TEXT,
    "headquarters" JSONB NOT NULL,
    "additionalLocations" JSONB,
    "billingAddress" JSONB,
    "shippingAddresses" JSONB,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "timezone" TEXT,
    "preferredLanguage" "Locale" NOT NULL DEFAULT 'en',
    "preferredCurrency" "Currency" NOT NULL DEFAULT 'EUR',
    "size" "CompanySize",
    "marketsServed" TEXT[],
    "mainActivity" TEXT,
    "leadSource" "FirstContactChannel",
    "firstContact" JSONB NOT NULL,
    "territory" TEXT,
    "distributionMarkets" TEXT[],
    "cooperationModel" "CooperationModel",
    "relationshipStage" "RelationshipStage" NOT NULL DEFAULT 'lead',
    "leadScore" INTEGER,
    "probability" INTEGER,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "ndaStatus" "NDAStatus",
    "latestSampleStatus" "SampleStatus",
    "productCategories" "ApplicationCategory"[],
    "applicationInterests" TEXT[],
    "estimatedAnnualPotentialMinor" INTEGER,
    "opportunityValueMinor" INTEGER,
    "commercialNotes" TEXT,
    "logisticsRequirements" TEXT,
    "preferredCourier" TEXT,
    "deliveryInstructions" TEXT,
    "customsInfo" TEXT,
    "paymentTerms" TEXT,
    "tags" TEXT[],
    "lastActivityAt" TIMESTAMP(3),
    "nextAction" JSONB,
    "ownerUserId" TEXT NOT NULL,
    "supportingTeamUserIds" TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "businessRole" TEXT,
    "decisionRole" "DecisionRole",
    "email" TEXT NOT NULL,
    "secondaryEmail" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "linkedin" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "timezone" TEXT,
    "preferredLanguage" "Locale",
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isTechnical" BOOLEAN NOT NULL DEFAULT false,
    "isCommercial" BOOLEAN NOT NULL DEFAULT false,
    "isLegal" BOOLEAN NOT NULL DEFAULT false,
    "isLogistics" BOOLEAN NOT NULL DEFAULT false,
    "isFinance" BOOLEAN NOT NULL DEFAULT false,
    "communicationPreferences" TEXT[],
    "lastContactAt" TIMESTAMP(3),
    "nextAction" JSONB,
    "ownerUserId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL DEFAULT 'lead',
    "segment" "CommercialSegment",
    "expectedValueMinor" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "probability" INTEGER,
    "expectedCloseDate" TIMESTAMP(3),
    "nextAction" JSONB,
    "ownerUserId" TEXT NOT NULL,
    "applicationCategory" "ApplicationCategory",
    "productInterest" TEXT,
    "lossReason" TEXT,
    "competitorNotes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_history" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ApplicationCategory" NOT NULL,
    "sku" TEXT,
    "format" TEXT,
    "segment" "CommercialSegment",
    "companyId" TEXT,
    "brandName" TEXT,
    "market" TEXT,
    "proaminaDosage" TEXT,
    "attributes" JSONB,
    "specs" JSONB,
    "indicativePriceMinor" INTEGER,
    "currency" "Currency",
    "status" "ProductStatus" NOT NULL DEFAULT 'in_development',
    "description" TEXT,
    "imageUrl" TEXT,
    "relatedProjectId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "projectId" TEXT,
    "productId" TEXT,
    "applicationCategory" "ApplicationCategory" NOT NULL,
    "requestedProduct" TEXT NOT NULL,
    "testObjective" TEXT,
    "requestedQuantity" DECIMAL(65,30) NOT NULL,
    "approvedQuantity" DECIMAL(65,30),
    "unit" "QuantityUnit" NOT NULL,
    "lotBatch" TEXT,
    "packagingType" TEXT,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "approvalDate" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL,
    "assignedLogisticsUserId" TEXT,
    "accountOwnerUserId" TEXT,
    "approvedByUserId" TEXT,
    "internalInstructions" TEXT,
    "clientVisibleNotes" TEXT,
    "customsNotes" TEXT,
    "requiredDocuments" TEXT[],
    "attachments" JSONB,
    "deliveryAddress" JSONB,
    "recipient" TEXT,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'draft',
    "statusHistory" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sampleRequestId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderLocation" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "courier" TEXT,
    "service" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "shipmentDate" TIMESTAMP(3),
    "estimatedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "packageCount" INTEGER,
    "weightKg" DECIMAL(65,30),
    "dimensions" TEXT,
    "shippingCost" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "customsStatus" "CustomsStatus",
    "incoterm" "Incoterm",
    "isExtraEU" BOOLEAN NOT NULL DEFAULT false,
    "originCountry" TEXT,
    "destinationCountry" TEXT,
    "eoriImportInfo" TEXT,
    "customsDocuments" JSONB,
    "proofOfDelivery" JSONB,
    "lineItems" JSONB,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "deliveryIssue" TEXT,
    "isDelayed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedByContactId" TEXT,
    "assignedLogisticsUserId" TEXT,
    "internalNotes" TEXT,
    "clientVisibleNotes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "rawPayload" JSONB,
    "actorUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "sampleRequestId" TEXT,
    "shipmentId" TEXT,
    "projectId" TEXT,
    "lotBatch" TEXT,
    "applicationCategory" "ApplicationCategory" NOT NULL,
    "productProjectName" TEXT,
    "testDate" TIMESTAMP(3),
    "overallResult" "FeedbackResult",
    "overallRating" INTEGER,
    "tasteAroma" TEXT,
    "solubility" TEXT,
    "processingBehaviour" TEXT,
    "texture" TEXT,
    "appearanceColour" TEXT,
    "comparisonControl" TEXT,
    "issuesEncountered" TEXT,
    "questions" TEXT,
    "requestedSupport" TEXT,
    "preferredNextStep" "NextStep",
    "availabilityForCall" TEXT,
    "requiresRnDAction" BOOLEAN NOT NULL DEFAULT false,
    "technicalReply" TEXT,
    "attachments" JSONB,
    "priority" "Priority" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'received',
    "technicalOwnerUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_comments" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "byUserId" TEXT,
    "byContactId" TEXT,
    "visibility" "FeedbackCommentVisibility" NOT NULL DEFAULT 'internal',
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_projects" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientProjectCode" TEXT,
    "productName" TEXT,
    "brandName" TEXT,
    "category" "ApplicationCategory" NOT NULL,
    "subcategory" TEXT,
    "market" TEXT,
    "objective" TEXT,
    "developmentStage" "DevelopmentStage" NOT NULL DEFAULT 'concept',
    "testStage" "TestStage",
    "lotBatch" TEXT,
    "testRounds" INTEGER,
    "currentResult" "FeedbackResult",
    "estimatedLaunch" TIMESTAMP(3),
    "estimatedAnnualVolume" DECIMAL(65,30),
    "commercialPotential" INTEGER,
    "contactIds" TEXT[],
    "internalOwnerUserId" TEXT,
    "technicalOwnerUserId" TEXT,
    "productId" TEXT,
    "nextAction" JSONB,
    "attachments" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ndas" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "NDAType" NOT NULL DEFAULT 'mutual',
    "status" "NDAStatus" NOT NULL DEFAULT 'to_prepare',
    "templateVersion" TEXT,
    "datePrepared" TIMESTAMP(3),
    "dateSent" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "internalSignatory" TEXT,
    "externalSignatory" TEXT,
    "counterpartySignerName" TEXT,
    "requestedModifications" TEXT,
    "governingLaw" TEXT,
    "jurisdiction" TEXT,
    "permittedAffiliates" TEXT,
    "permittedSubDistributors" TEXT,
    "reminderDates" TIMESTAMP(3)[],
    "accessLevelUnlocked" "DocumentAccessLevel",
    "signedFileId" TEXT,
    "approvedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ndas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'other',
    "confidentialityClass" "DocumentAccessLevel" NOT NULL DEFAULT 'internal',
    "companyId" TEXT,
    "version" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileType" TEXT,
    "sizeBytes" INTEGER,
    "description" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "currentVersionId" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "ndaId" TEXT,
    "version" TEXT NOT NULL,
    "versionDate" TIMESTAMP(3),
    "note" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "googleRevisionId" TEXT,
    "uploadedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_events" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" "DocumentAccessAction" NOT NULL,
    "confidentialityClassAtAccess" "DocumentAccessLevel",
    "actorUserId" TEXT,
    "companyScopeId" TEXT,
    "result" TEXT,
    "reason" TEXT,
    "signedUrlExpiresAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeKb" INTEGER,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "documentId" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "googleAccountEmail" TEXT NOT NULL,
    "googleSub" TEXT,
    "isServiceAccount" BOOLEAN NOT NULL DEFAULT false,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "scopes" "GoogleScope"[],
    "status" "GoogleTokenStatus" NOT NULL DEFAULT 'active',
    "accessTokenExpiresAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_drive_file_links" (
    "id" TEXT NOT NULL,
    "googleFileId" TEXT NOT NULL,
    "documentId" TEXT,
    "companyId" TEXT,
    "name" TEXT,
    "mimeType" TEXT,
    "webViewLink" TEXT,
    "accessLevel" "DocumentAccessLevel" NOT NULL DEFAULT 'internal',
    "version" TEXT,
    "latestRevisionId" TEXT,
    "driveModifiedTime" TIMESTAMP(3),
    "linkedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_file_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER,
    "vatTotal" INTEGER,
    "shippingCost" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "pricePerKg" INTEGER,
    "discountPct" DECIMAL(65,30),
    "vatPct" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "orderedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "fulfillmentRef" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER,
    "vatTotal" INTEGER,
    "shippingCost" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "confirmedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "pricePerKg" INTEGER,
    "discountPct" DECIMAL(65,30),
    "vatPct" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "number" TEXT,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'draft',
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER,
    "vatTotal" INTEGER,
    "shippingCost" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "outstandingAmount" INTEGER,
    "overdueAmount" INTEGER,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "issuedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "pricePerKg" INTEGER,
    "discountPct" DECIMAL(65,30),
    "vatPct" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "method" "PaymentMethod" NOT NULL DEFAULT 'bank_transfer',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "number" TEXT,
    "invoiceId" TEXT NOT NULL,
    "companyId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "reason" TEXT,
    "issuedAt" TIMESTAMP(3),
    "notes" TEXT,
    "issuedByUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'other',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "source" "TaskSource" NOT NULL DEFAULT 'manual',
    "companyId" TEXT,
    "contactId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "reminderDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_collaborators" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL DEFAULT 'video_call',
    "status" "MeetingStatus" NOT NULL DEFAULT 'scheduled',
    "companyId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3),
    "durationMin" INTEGER,
    "location" TEXT,
    "agenda" TEXT,
    "notes" TEXT,
    "outcome" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_contacts" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "actorUserId" TEXT,
    "actorContactId" TEXT,
    "visibility" "ActivityVisibility",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "workspace" "Workspace" NOT NULL,
    "scope" "Workspace",
    "title" TEXT NOT NULL,
    "body" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "recipientUserId" TEXT,
    "audienceRoles" "RoleKey"[],
    "audienceCompanyId" TEXT,
    "companyId" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "subject" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "status" "SupportStatus" NOT NULL DEFAULT 'open',
    "assignedOwnerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedDate" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "supportRequestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorContactId" TEXT,
    "visibility" "ActivityVisibility",
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_threads" (
    "id" TEXT NOT NULL,
    "audience" "AssistantAudience" NOT NULL,
    "title" TEXT,
    "userId" TEXT,
    "companyId" TEXT,
    "actorRole" "RoleKey",
    "lastMessageAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "AssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolArgs" JSONB,
    "toolCallStatus" "AssistantToolCallStatus",
    "confirmedByUserId" TEXT,
    "tokenUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_citations" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "targetType" "AssistantCitationTargetType" NOT NULL,
    "targetId" TEXT,
    "citedDocumentId" TEXT,
    "label" TEXT,
    "snippet" TEXT,
    "accessLevel" "DocumentAccessLevel",
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_citations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_contactId_key" ON "users"("contactId");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_kind_idx" ON "users"("kind");

-- CreateIndex
CREATE INDEX "users_invitedByUserId_idx" ON "users"("invitedByUserId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "mfa_factors_userId_idx" ON "mfa_factors"("userId");

-- CreateIndex
CREATE INDEX "mfa_factors_status_idx" ON "mfa_factors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_kind_idx" ON "roles"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_reference_key" ON "registrations"("reference");

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "registrations"("status");

-- CreateIndex
CREATE INDEX "registrations_contactEmail_idx" ON "registrations"("contactEmail");

-- CreateIndex
CREATE INDEX "registrations_linkedCompanyId_idx" ON "registrations"("linkedCompanyId");

-- CreateIndex
CREATE INDEX "registrations_decidedByUserId_idx" ON "registrations"("decidedByUserId");

-- CreateIndex
CREATE INDEX "registrations_companyType_idx" ON "registrations"("companyType");

-- CreateIndex
CREATE INDEX "registration_decisions_registrationId_idx" ON "registration_decisions"("registrationId");

-- CreateIndex
CREATE INDEX "registration_decisions_decidedByUserId_idx" ON "registration_decisions"("decidedByUserId");

-- CreateIndex
CREATE INDEX "registration_decisions_provisionedCompanyId_idx" ON "registration_decisions"("provisionedCompanyId");

-- CreateIndex
CREATE INDEX "registration_decisions_provisionedOwnerUserId_idx" ON "registration_decisions"("provisionedOwnerUserId");

-- CreateIndex
CREATE INDEX "registration_decisions_decision_idx" ON "registration_decisions"("decision");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_companyId_idx" ON "audit_events"("companyId");

-- CreateIndex
CREATE INDEX "audit_events_result_idx" ON "audit_events"("result");

-- CreateIndex
CREATE INDEX "audit_events_occurredAt_idx" ON "audit_events"("occurredAt");

-- CreateIndex
CREATE INDEX "email_logs_trigger_idx" ON "email_logs"("trigger");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_recipientUserId_idx" ON "email_logs"("recipientUserId");

-- CreateIndex
CREATE INDEX "email_logs_companyId_idx" ON "email_logs"("companyId");

-- CreateIndex
CREATE INDEX "email_logs_relatedEntityType_relatedEntityId_idx" ON "email_logs"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "companies_type_idx" ON "companies"("type");

-- CreateIndex
CREATE INDEX "companies_segment_idx" ON "companies"("segment");

-- CreateIndex
CREATE INDEX "companies_country_idx" ON "companies"("country");

-- CreateIndex
CREATE INDEX "companies_relationshipStage_idx" ON "companies"("relationshipStage");

-- CreateIndex
CREATE INDEX "companies_ownerUserId_idx" ON "companies"("ownerUserId");

-- CreateIndex
CREATE INDEX "companies_priority_idx" ON "companies"("priority");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_ownerUserId_idx" ON "contacts"("ownerUserId");

-- CreateIndex
CREATE INDEX "contacts_isPrimary_idx" ON "contacts"("isPrimary");

-- CreateIndex
CREATE INDEX "opportunities_companyId_idx" ON "opportunities"("companyId");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_ownerUserId_idx" ON "opportunities"("ownerUserId");

-- CreateIndex
CREATE INDEX "opportunities_segment_idx" ON "opportunities"("segment");

-- CreateIndex
CREATE INDEX "opportunity_stage_history_opportunityId_idx" ON "opportunity_stage_history"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_stage_history_stage_idx" ON "opportunity_stage_history"("stage");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_companyId_idx" ON "products"("companyId");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_segment_idx" ON "products"("segment");

-- CreateIndex
CREATE UNIQUE INDEX "sample_requests_reference_key" ON "sample_requests"("reference");

-- CreateIndex
CREATE INDEX "sample_requests_companyId_idx" ON "sample_requests"("companyId");

-- CreateIndex
CREATE INDEX "sample_requests_contactId_idx" ON "sample_requests"("contactId");

-- CreateIndex
CREATE INDEX "sample_requests_opportunityId_idx" ON "sample_requests"("opportunityId");

-- CreateIndex
CREATE INDEX "sample_requests_projectId_idx" ON "sample_requests"("projectId");

-- CreateIndex
CREATE INDEX "sample_requests_status_idx" ON "sample_requests"("status");

-- CreateIndex
CREATE INDEX "sample_requests_assignedLogisticsUserId_idx" ON "sample_requests"("assignedLogisticsUserId");

-- CreateIndex
CREATE INDEX "sample_requests_accountOwnerUserId_idx" ON "sample_requests"("accountOwnerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_reference_key" ON "shipments"("reference");

-- CreateIndex
CREATE INDEX "shipments_companyId_idx" ON "shipments"("companyId");

-- CreateIndex
CREATE INDEX "shipments_sampleRequestId_idx" ON "shipments"("sampleRequestId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_customsStatus_idx" ON "shipments"("customsStatus");

-- CreateIndex
CREATE INDEX "shipments_assignedLogisticsUserId_idx" ON "shipments"("assignedLogisticsUserId");

-- CreateIndex
CREATE INDEX "shipments_estimatedDelivery_idx" ON "shipments"("estimatedDelivery");

-- CreateIndex
CREATE INDEX "shipment_events_shipmentId_idx" ON "shipment_events"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_events_status_idx" ON "shipment_events"("status");

-- CreateIndex
CREATE INDEX "shipment_events_occurredAt_idx" ON "shipment_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_reference_key" ON "feedbacks"("reference");

-- CreateIndex
CREATE INDEX "feedbacks_companyId_idx" ON "feedbacks"("companyId");

-- CreateIndex
CREATE INDEX "feedbacks_contactId_idx" ON "feedbacks"("contactId");

-- CreateIndex
CREATE INDEX "feedbacks_sampleRequestId_idx" ON "feedbacks"("sampleRequestId");

-- CreateIndex
CREATE INDEX "feedbacks_shipmentId_idx" ON "feedbacks"("shipmentId");

-- CreateIndex
CREATE INDEX "feedbacks_projectId_idx" ON "feedbacks"("projectId");

-- CreateIndex
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX "feedbacks_technicalOwnerUserId_idx" ON "feedbacks"("technicalOwnerUserId");

-- CreateIndex
CREATE INDEX "feedback_comments_feedbackId_idx" ON "feedback_comments"("feedbackId");

-- CreateIndex
CREATE INDEX "feedback_comments_byUserId_idx" ON "feedback_comments"("byUserId");

-- CreateIndex
CREATE INDEX "feedback_comments_byContactId_idx" ON "feedback_comments"("byContactId");

-- CreateIndex
CREATE INDEX "feedback_comments_visibility_idx" ON "feedback_comments"("visibility");

-- CreateIndex
CREATE INDEX "application_projects_companyId_idx" ON "application_projects"("companyId");

-- CreateIndex
CREATE INDEX "application_projects_developmentStage_idx" ON "application_projects"("developmentStage");

-- CreateIndex
CREATE INDEX "application_projects_category_idx" ON "application_projects"("category");

-- CreateIndex
CREATE INDEX "application_projects_internalOwnerUserId_idx" ON "application_projects"("internalOwnerUserId");

-- CreateIndex
CREATE INDEX "application_projects_technicalOwnerUserId_idx" ON "application_projects"("technicalOwnerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ndas_reference_key" ON "ndas"("reference");

-- CreateIndex
CREATE INDEX "ndas_companyId_idx" ON "ndas"("companyId");

-- CreateIndex
CREATE INDEX "ndas_status_idx" ON "ndas"("status");

-- CreateIndex
CREATE INDEX "ndas_signedFileId_idx" ON "ndas"("signedFileId");

-- CreateIndex
CREATE INDEX "ndas_approvedByUserId_idx" ON "ndas"("approvedByUserId");

-- CreateIndex
CREATE INDEX "ndas_expiryDate_idx" ON "ndas"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "documents_currentVersionId_key" ON "documents"("currentVersionId");

-- CreateIndex
CREATE INDEX "documents_companyId_idx" ON "documents"("companyId");

-- CreateIndex
CREATE INDEX "documents_confidentialityClass_idx" ON "documents"("confidentialityClass");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_uploadedByUserId_idx" ON "documents"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "documents_currentVersionId_idx" ON "documents"("currentVersionId");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

-- CreateIndex
CREATE INDEX "document_versions_ndaId_idx" ON "document_versions"("ndaId");

-- CreateIndex
CREATE INDEX "document_versions_uploadedByUserId_idx" ON "document_versions"("uploadedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "document_access_events_documentId_idx" ON "document_access_events"("documentId");

-- CreateIndex
CREATE INDEX "document_access_events_actorUserId_idx" ON "document_access_events"("actorUserId");

-- CreateIndex
CREATE INDEX "document_access_events_action_idx" ON "document_access_events"("action");

-- CreateIndex
CREATE INDEX "document_access_events_occurredAt_idx" ON "document_access_events"("occurredAt");

-- CreateIndex
CREATE INDEX "attachments_documentId_idx" ON "attachments"("documentId");

-- CreateIndex
CREATE INDEX "attachments_uploadedByUserId_idx" ON "attachments"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "google_oauth_tokens_userId_idx" ON "google_oauth_tokens"("userId");

-- CreateIndex
CREATE INDEX "google_oauth_tokens_status_idx" ON "google_oauth_tokens"("status");

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_tokens_googleAccountEmail_isServiceAccount_key" ON "google_oauth_tokens"("googleAccountEmail", "isServiceAccount");

-- CreateIndex
CREATE INDEX "google_drive_file_links_documentId_idx" ON "google_drive_file_links"("documentId");

-- CreateIndex
CREATE INDEX "google_drive_file_links_companyId_idx" ON "google_drive_file_links"("companyId");

-- CreateIndex
CREATE INDEX "google_drive_file_links_accessLevel_idx" ON "google_drive_file_links"("accessLevel");

-- CreateIndex
CREATE INDEX "google_drive_file_links_linkedByUserId_idx" ON "google_drive_file_links"("linkedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "google_drive_file_links_googleFileId_key" ON "google_drive_file_links"("googleFileId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_reference_key" ON "quotes"("reference");

-- CreateIndex
CREATE INDEX "quotes_companyId_idx" ON "quotes"("companyId");

-- CreateIndex
CREATE INDEX "quotes_opportunityId_idx" ON "quotes"("opportunityId");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_approvedByUserId_idx" ON "quotes"("approvedByUserId");

-- CreateIndex
CREATE INDEX "quote_line_items_quoteId_idx" ON "quote_line_items"("quoteId");

-- CreateIndex
CREATE INDEX "quote_line_items_productId_idx" ON "quote_line_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE INDEX "orders_companyId_idx" ON "orders"("companyId");

-- CreateIndex
CREATE INDEX "orders_quoteId_idx" ON "orders"("quoteId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_confirmedByUserId_idx" ON "orders"("confirmedByUserId");

-- CreateIndex
CREATE INDEX "order_line_items_orderId_idx" ON "order_line_items"("orderId");

-- CreateIndex
CREATE INDEX "order_line_items_productId_idx" ON "order_line_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_reference_key" ON "invoices"("reference");

-- CreateIndex
CREATE INDEX "invoices_companyId_idx" ON "invoices"("companyId");

-- CreateIndex
CREATE INDEX "invoices_orderId_idx" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_paymentStatus_idx" ON "invoices"("paymentStatus");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoices_issuedByUserId_idx" ON "invoices"("issuedByUserId");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_line_items_productId_idx" ON "invoice_line_items"("productId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_recordedByUserId_idx" ON "payments"("recordedByUserId");

-- CreateIndex
CREATE INDEX "payments_receivedAt_idx" ON "payments"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_reference_key" ON "credit_notes"("reference");

-- CreateIndex
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");

-- CreateIndex
CREATE INDEX "credit_notes_companyId_idx" ON "credit_notes"("companyId");

-- CreateIndex
CREATE INDEX "credit_notes_issuedByUserId_idx" ON "credit_notes"("issuedByUserId");

-- CreateIndex
CREATE INDEX "tasks_companyId_idx" ON "tasks"("companyId");

-- CreateIndex
CREATE INDEX "tasks_contactId_idx" ON "tasks"("contactId");

-- CreateIndex
CREATE INDEX "tasks_ownerUserId_idx" ON "tasks"("ownerUserId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- CreateIndex
CREATE INDEX "tasks_relatedType_relatedId_idx" ON "tasks"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- CreateIndex
CREATE INDEX "task_comments_authorUserId_idx" ON "task_comments"("authorUserId");

-- CreateIndex
CREATE INDEX "task_collaborators_userId_idx" ON "task_collaborators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_collaborators_taskId_userId_key" ON "task_collaborators"("taskId", "userId");

-- CreateIndex
CREATE INDEX "meetings_companyId_idx" ON "meetings"("companyId");

-- CreateIndex
CREATE INDEX "meetings_ownerUserId_idx" ON "meetings"("ownerUserId");

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- CreateIndex
CREATE INDEX "meetings_start_idx" ON "meetings"("start");

-- CreateIndex
CREATE INDEX "meeting_attendees_userId_idx" ON "meeting_attendees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meetingId_userId_key" ON "meeting_attendees"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "meeting_contacts_contactId_idx" ON "meeting_contacts"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_contacts_meetingId_contactId_key" ON "meeting_contacts"("meetingId", "contactId");

-- CreateIndex
CREATE INDEX "activities_companyId_idx" ON "activities"("companyId");

-- CreateIndex
CREATE INDEX "activities_contactId_idx" ON "activities"("contactId");

-- CreateIndex
CREATE INDEX "activities_actorUserId_idx" ON "activities"("actorUserId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_relatedType_relatedId_idx" ON "activities"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "activities_occurredAt_idx" ON "activities"("occurredAt");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_idx" ON "notifications"("recipientUserId");

-- CreateIndex
CREATE INDEX "notifications_audienceCompanyId_idx" ON "notifications"("audienceCompanyId");

-- CreateIndex
CREATE INDEX "notifications_companyId_idx" ON "notifications"("companyId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_relatedType_relatedId_idx" ON "notifications"("relatedType", "relatedId");

-- CreateIndex
CREATE UNIQUE INDEX "support_requests_reference_key" ON "support_requests"("reference");

-- CreateIndex
CREATE INDEX "support_requests_companyId_idx" ON "support_requests"("companyId");

-- CreateIndex
CREATE INDEX "support_requests_contactId_idx" ON "support_requests"("contactId");

-- CreateIndex
CREATE INDEX "support_requests_assignedOwnerUserId_idx" ON "support_requests"("assignedOwnerUserId");

-- CreateIndex
CREATE INDEX "support_requests_status_idx" ON "support_requests"("status");

-- CreateIndex
CREATE INDEX "support_requests_category_idx" ON "support_requests"("category");

-- CreateIndex
CREATE INDEX "support_messages_supportRequestId_idx" ON "support_messages"("supportRequestId");

-- CreateIndex
CREATE INDEX "support_messages_authorUserId_idx" ON "support_messages"("authorUserId");

-- CreateIndex
CREATE INDEX "support_messages_authorContactId_idx" ON "support_messages"("authorContactId");

-- CreateIndex
CREATE INDEX "assistant_threads_userId_idx" ON "assistant_threads"("userId");

-- CreateIndex
CREATE INDEX "assistant_threads_companyId_idx" ON "assistant_threads"("companyId");

-- CreateIndex
CREATE INDEX "assistant_threads_audience_idx" ON "assistant_threads"("audience");

-- CreateIndex
CREATE INDEX "assistant_threads_lastMessageAt_idx" ON "assistant_threads"("lastMessageAt");

-- CreateIndex
CREATE INDEX "assistant_messages_threadId_idx" ON "assistant_messages"("threadId");

-- CreateIndex
CREATE INDEX "assistant_messages_role_idx" ON "assistant_messages"("role");

-- CreateIndex
CREATE INDEX "assistant_messages_confirmedByUserId_idx" ON "assistant_messages"("confirmedByUserId");

-- CreateIndex
CREATE INDEX "assistant_messages_toolCallStatus_idx" ON "assistant_messages"("toolCallStatus");

-- CreateIndex
CREATE INDEX "assistant_citations_messageId_idx" ON "assistant_citations"("messageId");

-- CreateIndex
CREATE INDEX "assistant_citations_targetType_targetId_idx" ON "assistant_citations"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "assistant_citations_citedDocumentId_idx" ON "assistant_citations"("citedDocumentId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_linkedCompanyId_fkey" FOREIGN KEY ("linkedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_decisions" ADD CONSTRAINT "registration_decisions_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_decisions" ADD CONSTRAINT "registration_decisions_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_decisions" ADD CONSTRAINT "registration_decisions_provisionedCompanyId_fkey" FOREIGN KEY ("provisionedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_decisions" ADD CONSTRAINT "registration_decisions_provisionedContactId_fkey" FOREIGN KEY ("provisionedContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_decisions" ADD CONSTRAINT "registration_decisions_provisionedOwnerUserId_fkey" FOREIGN KEY ("provisionedOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_relatedProjectId_fkey" FOREIGN KEY ("relatedProjectId") REFERENCES "application_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "application_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_assignedLogisticsUserId_fkey" FOREIGN KEY ("assignedLogisticsUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_accountOwnerUserId_fkey" FOREIGN KEY ("accountOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sampleRequestId_fkey" FOREIGN KEY ("sampleRequestId") REFERENCES "sample_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_confirmedByContactId_fkey" FOREIGN KEY ("confirmedByContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_assignedLogisticsUserId_fkey" FOREIGN KEY ("assignedLogisticsUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_sampleRequestId_fkey" FOREIGN KEY ("sampleRequestId") REFERENCES "sample_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "application_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_technicalOwnerUserId_fkey" FOREIGN KEY ("technicalOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_byContactId_fkey" FOREIGN KEY ("byContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_projects" ADD CONSTRAINT "application_projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_projects" ADD CONSTRAINT "application_projects_internalOwnerUserId_fkey" FOREIGN KEY ("internalOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_projects" ADD CONSTRAINT "application_projects_technicalOwnerUserId_fkey" FOREIGN KEY ("technicalOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_projects" ADD CONSTRAINT "application_projects_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ndas" ADD CONSTRAINT "ndas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ndas" ADD CONSTRAINT "ndas_signedFileId_fkey" FOREIGN KEY ("signedFileId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ndas" ADD CONSTRAINT "ndas_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_ndaId_fkey" FOREIGN KEY ("ndaId") REFERENCES "ndas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_events" ADD CONSTRAINT "document_access_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_events" ADD CONSTRAINT "document_access_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_tokens" ADD CONSTRAINT "google_oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_drive_file_links" ADD CONSTRAINT "google_drive_file_links_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_drive_file_links" ADD CONSTRAINT "google_drive_file_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_drive_file_links" ADD CONSTRAINT "google_drive_file_links_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_contacts" ADD CONSTRAINT "meeting_contacts_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_contacts" ADD CONSTRAINT "meeting_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actorContactId_fkey" FOREIGN KEY ("actorContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_audienceCompanyId_fkey" FOREIGN KEY ("audienceCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assignedOwnerUserId_fkey" FOREIGN KEY ("assignedOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_authorContactId_fkey" FOREIGN KEY ("authorContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "assistant_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_citations" ADD CONSTRAINT "assistant_citations_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "assistant_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_citations" ADD CONSTRAINT "assistant_citations_citedDocumentId_fkey" FOREIGN KEY ("citedDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
