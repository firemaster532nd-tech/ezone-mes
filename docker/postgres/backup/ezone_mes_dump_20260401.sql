--
-- PostgreSQL database dump
--

\restrict 3zMkV4CizO1MvBS5uGpb5XQbvVt26bBAH7IyIabIXjtF3aXMqM5lEDbBg01gGNm

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval (
    approval_id integer NOT NULL,
    doc_type character varying(30) NOT NULL,
    doc_id integer NOT NULL,
    doc_title character varying(200),
    doc_summary text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    writer_id integer,
    reviewer_id integer,
    approver_id integer,
    reviewed_at timestamp with time zone,
    review_comment text,
    approved_at timestamp with time zone,
    approve_comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'REVIEW'::character varying, 'PENDING_APPROVE'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'RETURNED'::character varying])::text[])))
);


--
-- Name: approval_approval_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_approval_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_approval_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_approval_id_seq OWNED BY public.approval.approval_id;


--
-- Name: approval_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_line (
    line_id integer NOT NULL,
    doc_type character varying(30) NOT NULL,
    line_name character varying(100),
    reviewer_id integer,
    approver_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_line_doc_type_check CHECK (((doc_type)::text = ANY ((ARRAY['INCOMING_INSP'::character varying, 'PROCESS_INSP'::character varying, 'SELF_INSP'::character varying, 'SHIPMENT'::character varying, 'WORK_ORDER'::character varying, 'DAILY_LOG'::character varying, 'TBM'::character varying, 'INVENTORY'::character varying, 'PURCHASE_REQUEST'::character varying])::text[])))
);


--
-- Name: approval_line_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_line_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_line_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_line_line_id_seq OWNED BY public.approval_line.line_id;


--
-- Name: attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachment (
    att_id integer NOT NULL,
    ref_type character varying(20) NOT NULL,
    ref_id integer NOT NULL,
    file_name character varying(200) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    uploaded_by character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: attachment_att_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachment_att_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attachment_att_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachment_att_id_seq OWNED BY public.attachment.att_id;


--
-- Name: bom_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_master (
    bom_id integer NOT NULL,
    cert_id integer NOT NULL,
    component_name character varying(40) NOT NULL,
    item_id integer,
    qty_per_unit numeric(6,2) NOT NULL,
    spec_detail text,
    is_applicable boolean DEFAULT true,
    sort_order integer
);


--
-- Name: bom_master_bom_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_master_bom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_master_bom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_master_bom_id_seq OWNED BY public.bom_master.bom_id;


--
-- Name: cert_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cert_document (
    cert_doc_id integer NOT NULL,
    item_id integer,
    supplier_name character varying(100),
    supplier_lot character varying(50),
    test_institution character varying(100) NOT NULL,
    cert_number character varying(50),
    issued_date date NOT NULL,
    expiry_date date NOT NULL,
    test_items text,
    test_results text,
    is_valid boolean DEFAULT true,
    remarks text,
    file_path character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cert_document_cert_doc_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cert_document_cert_doc_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cert_document_cert_doc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cert_document_cert_doc_id_seq OWNED BY public.cert_document.cert_doc_id;


--
-- Name: certification_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification_master (
    cert_id integer NOT NULL,
    cert_number character varying(30) NOT NULL,
    product_group character varying(10) NOT NULL,
    structure_name character varying(60) NOT NULL,
    structure_code character varying(20) NOT NULL,
    install_position character varying(20) NOT NULL,
    fire_rating character varying(20),
    socket_name character varying(20),
    cert_area_sqmm integer,
    opening_w_mm integer,
    opening_h_mm integer,
    penetration_w_mm integer,
    penetration_h_mm integer,
    gap_limit_mm integer,
    gap_direction character varying(5) DEFAULT 'MAX'::character varying,
    install_qty integer DEFAULT 1,
    sheet_thickness_min numeric(3,1),
    sheet_thickness_prod numeric(3,1),
    cw_density_min integer,
    cw_density_prod integer,
    cert_version character varying(10),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT certification_master_install_position_check CHECK (((install_position)::text = ANY ((ARRAY['수직벽체'::character varying, '수평바닥'::character varying])::text[]))),
    CONSTRAINT certification_master_product_group_check CHECK (((product_group)::text = ANY ((ARRAY['MP'::character varying, 'BD'::character varying, 'NP'::character varying])::text[])))
);


--
-- Name: certification_master_cert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.certification_master_cert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: certification_master_cert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.certification_master_cert_id_seq OWNED BY public.certification_master.cert_id;


--
-- Name: certification_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certification_rule (
    rule_id integer NOT NULL,
    cert_id integer NOT NULL,
    rule_type character varying(15) NOT NULL,
    cert_value numeric(12,2) NOT NULL,
    direction character varying(5) NOT NULL,
    production_value numeric(12,2),
    tolerance_plus numeric(6,2),
    unit character varying(10),
    description text,
    CONSTRAINT certification_rule_direction_check CHECK (((direction)::text = ANY ((ARRAY['MAX'::character varying, 'MIN'::character varying])::text[]))),
    CONSTRAINT certification_rule_rule_type_check CHECK (((rule_type)::text = ANY ((ARRAY['AREA'::character varying, 'GAP'::character varying, 'PIPE'::character varying, 'THICKNESS'::character varying, 'DENSITY'::character varying, 'MASS'::character varying, 'LENGTH'::character varying, 'WIDTH'::character varying])::text[])))
);


--
-- Name: certification_rule_rule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.certification_rule_rule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: certification_rule_rule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.certification_rule_rule_id_seq OWNED BY public.certification_rule.rule_id;


--
-- Name: closing_adjustment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closing_adjustment (
    adj_id integer NOT NULL,
    closing_id integer NOT NULL,
    ci_id integer,
    item_id integer NOT NULL,
    lot_id integer,
    lot_number character varying(100),
    adj_type character varying(20) NOT NULL,
    adj_qty numeric(12,2) NOT NULL,
    reason text NOT NULL,
    process_zone character varying(20),
    approver_name character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_by character varying(100),
    requested_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    applied_at timestamp with time zone,
    inv_id integer,
    note text
);


--
-- Name: closing_adjustment_adj_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.closing_adjustment_adj_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: closing_adjustment_adj_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.closing_adjustment_adj_id_seq OWNED BY public.closing_adjustment.adj_id;


--
-- Name: closing_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closing_item (
    ci_id integer NOT NULL,
    closing_id integer NOT NULL,
    item_id integer NOT NULL,
    lot_id integer,
    lot_number character varying(100),
    item_category character varying(10),
    process_zone character varying(20),
    system_qty numeric(12,2) DEFAULT 0,
    physical_qty numeric(12,2),
    difference numeric(12,2),
    diff_rate numeric(8,4),
    unit character varying(20),
    count_status character varying(20) DEFAULT 'pending'::character varying,
    counted_by character varying(100),
    counted_at timestamp with time zone,
    verified_by character varying(100),
    verified_at timestamp with time zone,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: closing_item_ci_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.closing_item_ci_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: closing_item_ci_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.closing_item_ci_id_seq OWNED BY public.closing_item.ci_id;


--
-- Name: compounding_recipe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compounding_recipe (
    recipe_id integer NOT NULL,
    recipe_name character varying(100) NOT NULL,
    recipe_code character varying(30) NOT NULL,
    batch_size numeric(10,2) DEFAULT 300 NOT NULL,
    batch_unit character varying(10) DEFAULT 'kg'::character varying NOT NULL,
    is_certified boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: compounding_recipe_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compounding_recipe_item (
    recipe_item_id integer NOT NULL,
    recipe_id integer,
    item_id integer,
    qty numeric(10,2) NOT NULL,
    ratio numeric(5,2) NOT NULL,
    sort_order integer DEFAULT 0
);


--
-- Name: compounding_recipe_item_recipe_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compounding_recipe_item_recipe_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compounding_recipe_item_recipe_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compounding_recipe_item_recipe_item_id_seq OWNED BY public.compounding_recipe_item.recipe_item_id;


--
-- Name: compounding_recipe_recipe_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compounding_recipe_recipe_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compounding_recipe_recipe_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compounding_recipe_recipe_id_seq OWNED BY public.compounding_recipe.recipe_id;


--
-- Name: defect_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.defect_record (
    defect_id integer NOT NULL,
    wo_id integer,
    log_id integer,
    lot_number character varying(50),
    process_code character varying(10),
    defect_type character varying(50) NOT NULL,
    qty numeric(12,2) DEFAULT 1 NOT NULL,
    unit character varying(20) DEFAULT 'ea'::character varying,
    weight numeric(12,2),
    description text,
    disposition character varying(20) DEFAULT 'pending'::character varying,
    disposal_report_id integer,
    recorded_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT defect_record_disposition_check CHECK (((disposition)::text = ANY ((ARRAY['pending'::character varying, 'rework'::character varying, 'scrap'::character varying, 'downgrade'::character varying])::text[])))
);


--
-- Name: defect_record_defect_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.defect_record_defect_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: defect_record_defect_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.defect_record_defect_id_seq OWNED BY public.defect_record.defect_id;


--
-- Name: disposal_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disposal_report (
    report_id integer NOT NULL,
    report_number character varying(50) NOT NULL,
    defect_ids integer[],
    total_qty numeric(12,2),
    total_weight numeric(12,2),
    disposal_method character varying(50),
    reason text,
    created_by integer,
    approved_by integer,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    CONSTRAINT disposal_report_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending_approval'::character varying, 'approved'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: disposal_report_report_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.disposal_report_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: disposal_report_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.disposal_report_report_id_seq OWNED BY public.disposal_report.report_id;


--
-- Name: inspection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection (
    insp_id integer NOT NULL,
    insp_type character varying(10) NOT NULL,
    form_code character varying(20),
    wo_id integer,
    lot_id integer,
    cert_id integer,
    sampling_n integer DEFAULT 3,
    accept_c integer DEFAULT 0,
    result character varying(10),
    inspector character varying(30),
    inspected_at timestamp with time zone,
    shipped_at date,
    remarks text,
    cert_doc_id integer,
    ks_verified boolean DEFAULT false,
    cert_doc_verified boolean DEFAULT false,
    CONSTRAINT inspection_insp_type_check CHECK (((insp_type)::text = ANY ((ARRAY['INCOMING'::character varying, 'PROCESS'::character varying, 'FINAL'::character varying])::text[]))),
    CONSTRAINT inspection_result_check CHECK (((result)::text = ANY ((ARRAY['PASS'::character varying, 'FAIL'::character varying, 'PENDING'::character varying])::text[])))
);


--
-- Name: inspection_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspection_detail (
    detail_id integer NOT NULL,
    insp_id integer NOT NULL,
    item_no integer,
    quality_item character varying(30),
    check_item character varying(40),
    check_method character varying(20),
    cert_standard numeric(10,2),
    prod_standard numeric(10,2),
    measured_n1 numeric(10,2),
    measured_n2 numeric(10,2),
    measured_n3 numeric(10,2),
    is_applicable boolean DEFAULT true,
    item_result character varying(10),
    unit character varying(20),
    CONSTRAINT inspection_detail_item_result_check CHECK (((item_result)::text = ANY ((ARRAY['PASS'::character varying, 'FAIL'::character varying, 'NA'::character varying])::text[])))
);


--
-- Name: inspection_detail_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_detail_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_detail_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_detail_detail_id_seq OWNED BY public.inspection_detail.detail_id;


--
-- Name: inspection_insp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inspection_insp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inspection_insp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inspection_insp_id_seq OWNED BY public.inspection.insp_id;


--
-- Name: inventory_closing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_closing (
    closing_id integer NOT NULL,
    closing_year integer NOT NULL,
    closing_month integer NOT NULL,
    closing_date date NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    finalized_at timestamp with time zone,
    notes text
);


--
-- Name: inventory_closing_closing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_closing_closing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_closing_closing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_closing_closing_id_seq OWNED BY public.inventory_closing.closing_id;


--
-- Name: inventory_transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transaction (
    inv_id integer NOT NULL,
    item_id integer NOT NULL,
    lot_id integer,
    txn_type character varying(5) NOT NULL,
    txn_date date NOT NULL,
    qty numeric(10,2) NOT NULL,
    balance numeric(10,2),
    purpose text,
    ref_wo_id integer,
    ref_lot_number character varying(50),
    worker character varying(30),
    confirmed_by character varying(30),
    source_lot character varying(100),
    linked_lot character varying(100),
    issuer_name character varying(100),
    verifier_name character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_transaction_txn_type_check CHECK (((txn_type)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying, 'ADJ'::character varying, 'LOSS'::character varying, 'SCRAP'::character varying])::text[])))
);


--
-- Name: inventory_transaction_inv_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_transaction_inv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_transaction_inv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_transaction_inv_id_seq OWNED BY public.inventory_transaction.inv_id;


--
-- Name: item_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_master (
    item_id integer NOT NULL,
    item_code character varying(20) NOT NULL,
    item_name character varying(80) NOT NULL,
    item_category character varying(5) NOT NULL,
    item_subcategory character varying(20),
    spec character varying(100),
    unit character varying(10) NOT NULL,
    cert_min_density numeric(6,2),
    cert_min_thickness numeric(4,1),
    cert_min_mass numeric(8,1),
    production_value numeric(8,2),
    tolerance_plus numeric(4,1),
    value_direction character varying(5),
    safety_stock numeric(10,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    ks_type character varying(10) DEFAULT 'NON_KS'::character varying,
    ks_number character varying(40),
    insp_form_code character varying(20),
    insp_spec_ref character varying(60),
    cert_test_items text,
    cert_test_cycle character varying(20) DEFAULT '1회/년'::character varying,
    roll_length_m numeric(8,2),
    roll_spec character varying(100),
    CONSTRAINT item_master_item_category_check CHECK (((item_category)::text = ANY ((ARRAY['RM'::character varying, 'SM'::character varying, 'SA'::character varying, 'FP'::character varying])::text[]))),
    CONSTRAINT item_master_ks_type_check CHECK (((ks_type)::text = ANY ((ARRAY['KS'::character varying, 'NON_KS'::character varying, 'KS_PROC'::character varying])::text[]))),
    CONSTRAINT item_master_value_direction_check CHECK (((value_direction)::text = ANY ((ARRAY['MIN'::character varying, 'MAX'::character varying])::text[])))
);


--
-- Name: item_master_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_master_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_master_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_master_item_id_seq OWNED BY public.item_master.item_id;


--
-- Name: loss_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loss_record (
    loss_id integer NOT NULL,
    wo_id integer,
    log_id integer,
    process_code character varying(10) NOT NULL,
    lot_number character varying(50),
    planned_input numeric(12,2),
    actual_input numeric(12,2),
    actual_output numeric(12,2),
    loss_qty numeric(12,2),
    loss_rate numeric(5,2),
    weighed_qty numeric(12,2),
    remarks text,
    recorded_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: loss_record_loss_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loss_record_loss_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loss_record_loss_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loss_record_loss_id_seq OWNED BY public.loss_record.loss_id;


--
-- Name: lot_genealogy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lot_genealogy (
    genealogy_id integer NOT NULL,
    parent_lot_id integer NOT NULL,
    child_lot_id integer NOT NULL,
    consumed_qty numeric(10,2),
    component_position character varying(30)
);


--
-- Name: lot_genealogy_genealogy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lot_genealogy_genealogy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lot_genealogy_genealogy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lot_genealogy_genealogy_id_seq OWNED BY public.lot_genealogy.genealogy_id;


--
-- Name: lot_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lot_properties (
    prop_id integer NOT NULL,
    lot_number character varying(50) NOT NULL,
    process_code character varying(10),
    log_id integer,
    inspection_id integer,
    density numeric(8,4),
    density_unit character varying(10) DEFAULT 'g/cm³'::character varying,
    thickness numeric(8,2),
    width numeric(8,2),
    length_calculated numeric(12,2),
    input_weight_kg numeric(12,2),
    output_weight_kg numeric(12,2),
    loss_weight_kg numeric(12,2),
    output_length_m numeric(12,2),
    loss_length_m numeric(12,2),
    theoretical_loss_kg numeric(12,2),
    actual_vs_theoretical_diff numeric(12,2),
    recorded_by integer,
    remarks text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lot_properties_prop_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lot_properties_prop_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lot_properties_prop_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lot_properties_prop_id_seq OWNED BY public.lot_properties.prop_id;


--
-- Name: lot_transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lot_transaction (
    lot_id integer NOT NULL,
    lot_number character varying(100) NOT NULL,
    lot_type character varying(5) NOT NULL,
    item_id integer,
    wo_id integer,
    qty numeric(10,2) NOT NULL,
    unit character varying(10),
    supplier_lot character varying(30),
    inspection_lot character varying(30),
    inspection_result character varying(10),
    cert_compliant boolean,
    status character varying(10) DEFAULT 'ACTIVE'::character varying,
    remaining_qty numeric(10,2),
    location character varying(20),
    serial_start integer,
    serial_end integer,
    base_lot character varying(100) DEFAULT NULL::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lot_transaction_inspection_result_check CHECK (((inspection_result)::text = ANY ((ARRAY['PASS'::character varying, 'FAIL'::character varying, 'PENDING'::character varying])::text[]))),
    CONSTRAINT lot_transaction_lot_type_check CHECK (((lot_type)::text = ANY ((ARRAY['IN'::character varying, 'MIX'::character varying, 'EXT'::character varying, 'CUT'::character varying, 'ASM'::character varying, 'GI'::character varying, 'CW'::character varying, 'SS'::character varying, 'GW'::character varying, 'OUT'::character varying])::text[]))),
    CONSTRAINT lot_transaction_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'CONSUMED'::character varying, 'SHIPPED'::character varying, 'SCRAPPED'::character varying])::text[])))
);


--
-- Name: lot_transaction_lot_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lot_transaction_lot_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lot_transaction_lot_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lot_transaction_lot_id_seq OWNED BY public.lot_transaction.lot_id;


--
-- Name: order_bom_result; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_bom_result (
    result_id integer NOT NULL,
    order_id integer NOT NULL,
    order_item_id integer,
    item_id integer,
    item_code character varying(30),
    item_name character varying(200),
    item_category character varying(10),
    required_qty numeric(12,2) DEFAULT 0 NOT NULL,
    unit character varying(10),
    current_stock numeric(12,2) DEFAULT 0,
    shortage_qty numeric(12,2) DEFAULT 0,
    component_name text,
    spec_detail text,
    calc_note text,
    created_at timestamp with time zone DEFAULT now(),
    bom_level integer DEFAULT 0,
    parent_group character varying(30),
    source_type character varying(15),
    group_sort integer DEFAULT 0
);


--
-- Name: order_bom_result_result_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_bom_result_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_bom_result_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_bom_result_result_id_seq OWNED BY public.order_bom_result.result_id;


--
-- Name: process_bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_bom (
    bom_id integer NOT NULL,
    process_code character varying(10) NOT NULL,
    bom_name character varying(100) NOT NULL,
    bom_code character varying(50) NOT NULL,
    cert_id integer,
    output_item_id integer,
    output_qty numeric(12,2) DEFAULT 1,
    output_unit character varying(20) DEFAULT 'ea'::character varying,
    loss_rate numeric(5,2) DEFAULT 0,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT process_bom_process_code_check CHECK (((process_code)::text = ANY ((ARRAY['MIX'::character varying, 'EXT'::character varying, 'CUT'::character varying, 'ASM'::character varying, 'SHP'::character varying])::text[])))
);


--
-- Name: process_bom_bom_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.process_bom_bom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: process_bom_bom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.process_bom_bom_id_seq OWNED BY public.process_bom.bom_id;


--
-- Name: process_bom_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_bom_item (
    bom_item_id integer NOT NULL,
    bom_id integer NOT NULL,
    item_id integer,
    component_name character varying(100) NOT NULL,
    qty numeric(12,4) DEFAULT 1 NOT NULL,
    unit character varying(20) DEFAULT 'ea'::character varying,
    spec_detail text,
    is_key_material boolean DEFAULT true,
    sort_order integer DEFAULT 0
);


--
-- Name: process_bom_item_bom_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.process_bom_item_bom_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: process_bom_item_bom_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.process_bom_item_bom_item_id_seq OWNED BY public.process_bom_item.bom_item_id;


--
-- Name: process_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_event (
    event_id integer NOT NULL,
    log_id integer NOT NULL,
    event_type character varying(20) NOT NULL,
    worker_id integer,
    reason text,
    qty_at_event numeric(12,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT process_event_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['START'::character varying, 'PAUSE'::character varying, 'RESUME'::character varying, 'COMPLETE'::character varying, 'WORKER_CHANGE'::character varying, 'DEFECT'::character varying, 'NOTE'::character varying])::text[])))
);


--
-- Name: process_event_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.process_event_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: process_event_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.process_event_event_id_seq OWNED BY public.process_event.event_id;


--
-- Name: process_issue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_issue (
    issue_id integer NOT NULL,
    log_id integer,
    wo_id integer,
    process_code character varying(10) NOT NULL,
    lot_number character varying(50),
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    issue_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'minor'::character varying,
    description text NOT NULL,
    root_cause text,
    corrective_action text,
    loss_impact_kg numeric(12,2),
    recorded_by integer,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT process_issue_severity_check CHECK (((severity)::text = ANY ((ARRAY['minor'::character varying, 'major'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: process_issue_issue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.process_issue_issue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: process_issue_issue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.process_issue_issue_id_seq OWNED BY public.process_issue.issue_id;


--
-- Name: process_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_log (
    log_id integer NOT NULL,
    wo_id integer NOT NULL,
    process_code character varying(5) NOT NULL,
    shift character varying(20) NOT NULL,
    worker_id integer,
    status character varying(15) DEFAULT 'READY'::character varying,
    planned_qty numeric(12,2),
    produced_qty numeric(12,2) DEFAULT 0,
    defect_qty numeric(12,2) DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    actual_input_qty numeric(12,2),
    loss_qty numeric(12,2),
    loss_rate numeric(5,2),
    bom_id integer,
    weighed_input numeric(12,2),
    weighed_output numeric(12,2),
    weighed_loss numeric(12,2),
    inventory_applied boolean DEFAULT false,
    worker_ids text,
    worker_names text,
    CONSTRAINT process_log_status_check CHECK (((status)::text = ANY ((ARRAY['READY'::character varying, 'RUNNING'::character varying, 'PAUSED'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: process_log_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.process_log_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: process_log_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.process_log_log_id_seq OWNED BY public.process_log.log_id;


--
-- Name: product_bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_bom (
    pbom_id integer NOT NULL,
    sbom_id integer NOT NULL,
    item_id integer NOT NULL,
    component_name character varying(100) NOT NULL,
    component_type character varying(30) NOT NULL,
    source_type character varying(15) NOT NULL,
    qty_formula text,
    qty_fixed numeric(8,2),
    length_formula text,
    unit character varying(10) DEFAULT 'EA'::character varying NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    spec_detail text,
    CONSTRAINT product_bom_component_type_check CHECK (((component_type)::text = ANY ((ARRAY['SOCKET_BODY'::character varying, 'SHEET_INTERIOR'::character varying, 'SHEET_EXTERIOR'::character varying, 'CERAMIC_EXT'::character varying, 'BRACKET_GI'::character varying, 'SHEET'::character varying, 'BRACKET'::character varying, 'INSULATION'::character varying, 'SEALANT'::character varying, 'GAP_SHEET'::character varying, 'FIXING'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT product_bom_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['PURCHASE'::character varying, 'MANUFACTURE'::character varying])::text[])))
);


--
-- Name: product_bom_pbom_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_bom_pbom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_bom_pbom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_bom_pbom_id_seq OWNED BY public.product_bom.pbom_id;


--
-- Name: purchase_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request (
    pr_id integer NOT NULL,
    pr_number character varying(30) NOT NULL,
    order_id integer,
    pr_date date DEFAULT CURRENT_DATE NOT NULL,
    supplier_name character varying(200),
    status character varying(15) DEFAULT 'DRAFT'::character varying,
    remarks text,
    created_by character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    total_amount numeric(14,2) DEFAULT 0,
    CONSTRAINT purchase_request_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'ORDERED'::character varying, 'RECEIVED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: purchase_request_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_item (
    pri_id integer NOT NULL,
    pr_id integer NOT NULL,
    item_id integer NOT NULL,
    item_code character varying(30),
    item_name character varying(200),
    required_qty numeric(12,2) NOT NULL,
    order_qty numeric(12,2),
    unit character varying(10),
    unit_price numeric(12,2),
    delivery_date date,
    remarks text,
    sort_order integer DEFAULT 0,
    spec_detail text,
    calc_note text,
    component_name text,
    roll_count integer,
    roll_spec text,
    amount numeric(14,2),
    item_subcategory character varying(50),
    item_spec text,
    receiving_status character varying(20) DEFAULT 'PENDING'::character varying,
    received_qty numeric(12,2) DEFAULT 0,
    received_at timestamp with time zone,
    lot_id integer,
    insp_id integer
);


--
-- Name: purchase_request_item_pri_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_request_item_pri_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_request_item_pri_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_request_item_pri_id_seq OWNED BY public.purchase_request_item.pri_id;


--
-- Name: purchase_request_pr_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_request_pr_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_request_pr_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_request_pr_id_seq OWNED BY public.purchase_request.pr_id;


--
-- Name: sales_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order (
    order_id integer NOT NULL,
    order_number character varying(30) NOT NULL,
    order_date date NOT NULL,
    customer_name character varying(200) NOT NULL,
    project_name character varying(300),
    delivery_date date,
    status character varying(15) DEFAULT 'REGISTERED'::character varying,
    total_sets integer DEFAULT 0,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sales_order_status_check CHECK (((status)::text = ANY ((ARRAY['REGISTERED'::character varying, 'BOM_EXPLODED'::character varying, 'PO_CREATED'::character varying, 'IN_PRODUCTION'::character varying, 'SHIPPED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: sales_order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_item (
    order_item_id integer NOT NULL,
    order_id integer NOT NULL,
    cert_id integer NOT NULL,
    structure_code character varying(30) NOT NULL,
    qty integer DEFAULT 1 NOT NULL,
    opening_w_mm integer,
    opening_h_mm integer,
    penetration_w_mm integer,
    penetration_h_mm integer,
    spec_note text,
    sort_order integer DEFAULT 0
);


--
-- Name: sales_order_item_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_order_item_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_order_item_order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_order_item_order_item_id_seq OWNED BY public.sales_order_item.order_item_id;


--
-- Name: sales_order_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_order_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_order_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_order_order_id_seq OWNED BY public.sales_order.order_id;


--
-- Name: self_inspection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.self_inspection (
    self_insp_id integer NOT NULL,
    wo_id integer NOT NULL,
    check_time timestamp with time zone NOT NULL,
    check_category character varying(15) NOT NULL,
    check_point character varying(30),
    standard_value numeric(10,2),
    tolerance numeric(6,2),
    measured_value numeric(10,2),
    is_ok boolean,
    worker character varying(30),
    remarks text,
    CONSTRAINT self_inspection_check_category_check CHECK (((check_category)::text = ANY ((ARRAY['TEMP'::character varying, 'DIM'::character varying, 'VISUAL'::character varying, 'FILM'::character varying])::text[])))
);


--
-- Name: self_inspection_self_insp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.self_inspection_self_insp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: self_inspection_self_insp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.self_inspection_self_insp_id_seq OWNED BY public.self_inspection.self_insp_id;


--
-- Name: structure_bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.structure_bom (
    sbom_id integer NOT NULL,
    cert_id integer NOT NULL,
    group_code character varying(30) NOT NULL,
    group_name character varying(60) NOT NULL,
    group_type character varying(20) NOT NULL,
    source_type character varying(15) NOT NULL,
    output_item_id integer,
    qty_formula text,
    qty_fixed numeric(8,2),
    is_dimension_based boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    remarks text,
    CONSTRAINT structure_bom_group_type_check CHECK (((group_type)::text = ANY ((ARRAY['SOCKET'::character varying, 'FLASHING'::character varying, 'GAP_SHEET'::character varying, 'SUPPORT'::character varying, 'SEALANT'::character varying, 'FIXING'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT structure_bom_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['PURCHASE'::character varying, 'MANUFACTURE'::character varying])::text[])))
);


--
-- Name: structure_bom_sbom_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.structure_bom_sbom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: structure_bom_sbom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.structure_bom_sbom_id_seq OWNED BY public.structure_bom.sbom_id;


--
-- Name: tbm_attendee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbm_attendee (
    attendee_id integer NOT NULL,
    tbm_id integer NOT NULL,
    worker_name character varying(50) NOT NULL,
    department character varying(50),
    is_present boolean DEFAULT false,
    sign_time timestamp with time zone,
    remarks character varying(200)
);


--
-- Name: tbm_attendee_attendee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbm_attendee_attendee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbm_attendee_attendee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbm_attendee_attendee_id_seq OWNED BY public.tbm_attendee.attendee_id;


--
-- Name: tbm_issue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbm_issue (
    issue_id integer NOT NULL,
    tbm_id integer,
    title character varying(200) NOT NULL,
    description text,
    priority character varying(10) DEFAULT '보통'::character varying,
    status character varying(10) DEFAULT '미해결'::character varying,
    assigned_to character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    resolution text,
    due_date date,
    CONSTRAINT tbm_issue_priority_check CHECK (((priority)::text = ANY ((ARRAY['높음'::character varying, '보통'::character varying, '낮음'::character varying])::text[]))),
    CONSTRAINT tbm_issue_status_check CHECK (((status)::text = ANY ((ARRAY['미해결'::character varying, '진행중'::character varying, '지연'::character varying, '해결'::character varying])::text[])))
);


--
-- Name: tbm_issue_issue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbm_issue_issue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbm_issue_issue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbm_issue_issue_id_seq OWNED BY public.tbm_issue.issue_id;


--
-- Name: tbm_meeting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tbm_meeting (
    tbm_id integer NOT NULL,
    meeting_date date NOT NULL,
    session character varying(2) NOT NULL,
    conductor character varying(50) NOT NULL,
    safety_topics text,
    work_topics text,
    issue_topics text,
    weather character varying(20),
    temperature character varying(10),
    remarks text,
    status character varying(10) DEFAULT 'DRAFT'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT tbm_meeting_session_check CHECK (((session)::text = ANY ((ARRAY['AM'::character varying, 'PM'::character varying])::text[]))),
    CONSTRAINT tbm_meeting_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'COMPLETED'::character varying])::text[])))
);


--
-- Name: tbm_meeting_tbm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tbm_meeting_tbm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tbm_meeting_tbm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tbm_meeting_tbm_id_seq OWNED BY public.tbm_meeting.tbm_id;


--
-- Name: work_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order (
    wo_id integer NOT NULL,
    wo_number character varying(50),
    wo_date date NOT NULL,
    process_code character varying(5) NOT NULL,
    product_type character varying(50),
    cut_subtype character varying(10),
    install_type character varying(5),
    cert_id integer,
    order_id integer,
    item_id integer,
    planned_qty numeric(10,2),
    actual_qty numeric(10,2),
    status character varying(12) DEFAULT 'PLANNED'::character varying,
    equipment_id character varying(15),
    manager_id integer,
    am_worker character varying(50),
    pm_worker character varying(50),
    night_worker character varying(50),
    inspector character varying(30),
    start_time time without time zone,
    end_time time without time zone,
    downtime_minutes integer,
    downtime_reason text,
    production_length_m numeric(8,2),
    input_weight_kg numeric(8,2),
    scrap_kg numeric(8,2),
    serial_number integer,
    purpose character varying(50),
    spec_detail character varying(100),
    customer_name character varying(200),
    lot_number character varying(50),
    input_lot_numbers text,
    bom_version character varying(20),
    remarks text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    mix_time_minutes integer,
    actual_weight_kg numeric(10,2),
    incoming_inspection_status character varying(20),
    raw_material_lots text,
    thickness_mm numeric(6,2),
    width_mm numeric(8,2),
    density_gcm3 numeric(6,4),
    expansion_mm numeric(6,2),
    ext_spec character varying(100),
    project_site character varying(300),
    structure_name character varying(100),
    dimension_width numeric(8,1),
    dimension_height numeric(8,1),
    inner_width numeric(8,1),
    inner_height numeric(8,1),
    socket_lot character varying(100),
    sheet_lot character varying(100),
    ceramic_lot character varying(100),
    sealant_lot character varying(100),
    asm_structure character varying(50),
    asm_width numeric(8,1),
    asm_height numeric(8,1),
    CONSTRAINT work_order_process_code_check CHECK (((process_code)::text = ANY ((ARRAY['MIX'::character varying, 'EXT'::character varying, 'CUT'::character varying, 'ASM'::character varying, 'SHP'::character varying])::text[]))),
    CONSTRAINT work_order_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'HOLD'::character varying])::text[])))
);


--
-- Name: work_order_wo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_order_wo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_order_wo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_order_wo_id_seq OWNED BY public.work_order.wo_id;


--
-- Name: worker; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker (
    worker_id integer NOT NULL,
    worker_name character varying(50) NOT NULL,
    birth_date character varying(10),
    pin_code character varying(10),
    department character varying(50),
    "position" character varying(50),
    role character varying(20) DEFAULT 'worker'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT worker_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'worker'::character varying])::text[])))
);


--
-- Name: worker_worker_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_worker_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_worker_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_worker_id_seq OWNED BY public.worker.worker_id;


--
-- Name: approval approval_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval ALTER COLUMN approval_id SET DEFAULT nextval('public.approval_approval_id_seq'::regclass);


--
-- Name: approval_line line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_line ALTER COLUMN line_id SET DEFAULT nextval('public.approval_line_line_id_seq'::regclass);


--
-- Name: attachment att_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment ALTER COLUMN att_id SET DEFAULT nextval('public.attachment_att_id_seq'::regclass);


--
-- Name: bom_master bom_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_master ALTER COLUMN bom_id SET DEFAULT nextval('public.bom_master_bom_id_seq'::regclass);


--
-- Name: cert_document cert_doc_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_document ALTER COLUMN cert_doc_id SET DEFAULT nextval('public.cert_document_cert_doc_id_seq'::regclass);


--
-- Name: certification_master cert_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_master ALTER COLUMN cert_id SET DEFAULT nextval('public.certification_master_cert_id_seq'::regclass);


--
-- Name: certification_rule rule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_rule ALTER COLUMN rule_id SET DEFAULT nextval('public.certification_rule_rule_id_seq'::regclass);


--
-- Name: closing_adjustment adj_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_adjustment ALTER COLUMN adj_id SET DEFAULT nextval('public.closing_adjustment_adj_id_seq'::regclass);


--
-- Name: closing_item ci_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_item ALTER COLUMN ci_id SET DEFAULT nextval('public.closing_item_ci_id_seq'::regclass);


--
-- Name: compounding_recipe recipe_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe ALTER COLUMN recipe_id SET DEFAULT nextval('public.compounding_recipe_recipe_id_seq'::regclass);


--
-- Name: compounding_recipe_item recipe_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe_item ALTER COLUMN recipe_item_id SET DEFAULT nextval('public.compounding_recipe_item_recipe_item_id_seq'::regclass);


--
-- Name: defect_record defect_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_record ALTER COLUMN defect_id SET DEFAULT nextval('public.defect_record_defect_id_seq'::regclass);


--
-- Name: disposal_report report_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_report ALTER COLUMN report_id SET DEFAULT nextval('public.disposal_report_report_id_seq'::regclass);


--
-- Name: inspection insp_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection ALTER COLUMN insp_id SET DEFAULT nextval('public.inspection_insp_id_seq'::regclass);


--
-- Name: inspection_detail detail_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_detail ALTER COLUMN detail_id SET DEFAULT nextval('public.inspection_detail_detail_id_seq'::regclass);


--
-- Name: inventory_closing closing_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_closing ALTER COLUMN closing_id SET DEFAULT nextval('public.inventory_closing_closing_id_seq'::regclass);


--
-- Name: inventory_transaction inv_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transaction ALTER COLUMN inv_id SET DEFAULT nextval('public.inventory_transaction_inv_id_seq'::regclass);


--
-- Name: item_master item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_master ALTER COLUMN item_id SET DEFAULT nextval('public.item_master_item_id_seq'::regclass);


--
-- Name: loss_record loss_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_record ALTER COLUMN loss_id SET DEFAULT nextval('public.loss_record_loss_id_seq'::regclass);


--
-- Name: lot_genealogy genealogy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_genealogy ALTER COLUMN genealogy_id SET DEFAULT nextval('public.lot_genealogy_genealogy_id_seq'::regclass);


--
-- Name: lot_properties prop_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_properties ALTER COLUMN prop_id SET DEFAULT nextval('public.lot_properties_prop_id_seq'::regclass);


--
-- Name: lot_transaction lot_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_transaction ALTER COLUMN lot_id SET DEFAULT nextval('public.lot_transaction_lot_id_seq'::regclass);


--
-- Name: order_bom_result result_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_bom_result ALTER COLUMN result_id SET DEFAULT nextval('public.order_bom_result_result_id_seq'::regclass);


--
-- Name: process_bom bom_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom ALTER COLUMN bom_id SET DEFAULT nextval('public.process_bom_bom_id_seq'::regclass);


--
-- Name: process_bom_item bom_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom_item ALTER COLUMN bom_item_id SET DEFAULT nextval('public.process_bom_item_bom_item_id_seq'::regclass);


--
-- Name: process_event event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_event ALTER COLUMN event_id SET DEFAULT nextval('public.process_event_event_id_seq'::regclass);


--
-- Name: process_issue issue_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_issue ALTER COLUMN issue_id SET DEFAULT nextval('public.process_issue_issue_id_seq'::regclass);


--
-- Name: process_log log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_log ALTER COLUMN log_id SET DEFAULT nextval('public.process_log_log_id_seq'::regclass);


--
-- Name: product_bom pbom_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bom ALTER COLUMN pbom_id SET DEFAULT nextval('public.product_bom_pbom_id_seq'::regclass);


--
-- Name: purchase_request pr_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request ALTER COLUMN pr_id SET DEFAULT nextval('public.purchase_request_pr_id_seq'::regclass);


--
-- Name: purchase_request_item pri_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_item ALTER COLUMN pri_id SET DEFAULT nextval('public.purchase_request_item_pri_id_seq'::regclass);


--
-- Name: sales_order order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order ALTER COLUMN order_id SET DEFAULT nextval('public.sales_order_order_id_seq'::regclass);


--
-- Name: sales_order_item order_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_item ALTER COLUMN order_item_id SET DEFAULT nextval('public.sales_order_item_order_item_id_seq'::regclass);


--
-- Name: self_inspection self_insp_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_inspection ALTER COLUMN self_insp_id SET DEFAULT nextval('public.self_inspection_self_insp_id_seq'::regclass);


--
-- Name: structure_bom sbom_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_bom ALTER COLUMN sbom_id SET DEFAULT nextval('public.structure_bom_sbom_id_seq'::regclass);


--
-- Name: tbm_attendee attendee_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_attendee ALTER COLUMN attendee_id SET DEFAULT nextval('public.tbm_attendee_attendee_id_seq'::regclass);


--
-- Name: tbm_issue issue_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_issue ALTER COLUMN issue_id SET DEFAULT nextval('public.tbm_issue_issue_id_seq'::regclass);


--
-- Name: tbm_meeting tbm_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_meeting ALTER COLUMN tbm_id SET DEFAULT nextval('public.tbm_meeting_tbm_id_seq'::regclass);


--
-- Name: work_order wo_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order ALTER COLUMN wo_id SET DEFAULT nextval('public.work_order_wo_id_seq'::regclass);


--
-- Name: worker worker_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker ALTER COLUMN worker_id SET DEFAULT nextval('public.worker_worker_id_seq'::regclass);


--
-- Data for Name: approval; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approval (approval_id, doc_type, doc_id, doc_title, doc_summary, status, writer_id, reviewer_id, approver_id, reviewed_at, review_comment, approved_at, approve_comment, created_at, updated_at) FROM stdin;
4	PURCHASE_REQUEST	3	자재발주서 PR-260330-001 (수주: SO-260303-001)	고객사: ㈜하나로엔지니어링 | 프로젝트: 인천검단101역세권C1현장 | 발주 품목: 9건 | 총 금액: 0원	APPROVED	6	2	6	2026-03-30 04:24:18.004328+00	\N	2026-03-30 04:25:06.716553+00	\N	2026-03-30 04:20:23.28616+00	2026-03-30 04:25:06.716553+00
5	PURCHASE_REQUEST	1	자재발주서 PR-260331-001 (수주: SO-260303-001)	고객사: ㈜하나로엔지니어링 | 프로젝트: 인천검단101역세권C1현장 | 발주 품목: 16건 | 총 금액: 0원	APPROVED	1	2	6	2026-03-31 14:04:10.615012+00	\N	2026-03-31 14:05:10.995057+00	\N	2026-03-31 12:09:19.143074+00	2026-03-31 14:05:10.995057+00
\.


--
-- Data for Name: approval_line; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.approval_line (line_id, doc_type, line_name, reviewer_id, approver_id, is_active, created_at) FROM stdin;
2	PURCHASE_REQUEST	자재발주서 결재	2	6	t	2026-03-30 04:06:28.262549+00
\.


--
-- Data for Name: attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attachment (att_id, ref_type, ref_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: bom_master; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bom_master (bom_id, cert_id, component_name, item_id, qty_per_unit, spec_detail, is_applicable, sort_order) FROM stdin;
1	1	금속소켓 본체	23	2.00	t1.6, 2600×650, h200	t	1
2	1	내부시트(받침대)	21	4.00	밀도1.2g/cm³, t5.0, L1280, W190	t	2
3	1	내부시트(상/하)	21	4.00	밀도1.2g/cm³, t5.0, L1280, W190	t	3
4	1	내부시트(좌/우)	21	8.00	밀도1.2g/cm³, t5.0, L305, W190	t	4
5	1	외부시트(상/하)	21	2.00	밀도1.2g/cm³, t5.0, L2660, W190 + CW t25, W200	t	5
6	1	외부시트(좌/우)	21	2.00	밀도1.2g/cm³, t5.0, L650, W190 + CW t25, W200	t	6
7	1	방화플래싱(I형)	33	16.00	t5.0, W125, L1000 + 강판 t0.5, W125, L1000	t	7
8	1	방화댐퍼	5	1.00	t1.6, 2600×650, h200	t	8
9	1	실란트	13	1.00	KS F 4910 F-12.5E, t3이상, 오버랩3이상	t	9
10	1	지지구조 단열재(1단)	10	2.00	CW 96kg/m³, t50, W600, 양면대칭	t	10
11	1	지지구조 단열재(2단)	11	2.00	GW 24kg/m³, t25, W1400, 양면대칭	t	11
12	1	C/BAR	5	1.00	t1.0, 간격50이하	t	12
13	1	보온핀	15	1.00	3인치이상, 간격650이하	t	13
14	2	금속소켓 본체	25	1.00	t1.6, 1400×350, h200	t	1
15	2	내부시트(상/하)	21	2.00	밀도1.2g/cm³, t5.0, L1395, W190	t	2
16	2	내부시트(좌/우)	21	2.00	밀도1.2g/cm³, t5.0, L320, W190	t	3
17	2	외부시트(상/하)	21	2.00	밀도1.2g/cm³, t5.0, L1460 + CW t25, W200	t	4
18	2	외부시트(좌/우)	21	2.00	밀도1.2g/cm³, t5.0, L350 + CW t25, W200	t	5
19	2	방화플래싱(I형)	33	10.00	t5.0, W125, L1000 + 강판 t0.5, W125, L1000	t	6
20	2	지지구조 단열재	11	2.00	GW 24kg/m³, t25, W1400+W1000, 양면대칭	t	7
21	11	틈새복합시트(상하) 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L300, 상하2세트×2개	t	1
22	11	틈새복합시트(상하) 세라믹	10	2.00	96K, t25, H150, L300, 상하2세트	t	2
23	11	틈새복합시트(좌우) 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L230, 좌우2세트×2개	t	3
24	11	틈새복합시트(좌우) 세라믹	10	2.00	96K, t25, H150, L230, 좌우2세트	t	4
25	11	방화플래싱(SUS304)	36	4.00	SUS304 t0.5, W190×L380 + 차열시트 t5.0, W190×L380	t	5
26	11	실란트	13	1.00	KS F 4910 F-12.5E, t3이상, 오버랩3이상	t	6
27	11	지지구조 세라믹단열재	10	2.00	96K, t25, W600, 양면대칭, 철사고정	t	7
28	12	틈새복합시트(상하) 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L1000, 상하×4개	t	1
29	12	틈새복합시트(상하) 세라믹	10	2.00	96K, t25, H150, L1000, 상하×2개	t	2
30	12	틈새복합시트(좌우) 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L180, 좌우×4개	t	3
31	12	틈새복합시트(좌우) 세라믹	10	2.00	96K, t25, H150, L180, 좌우×2개	t	4
32	12	틈새 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L180, 틈새×4개	t	5
33	12	방화플래싱 상하(아연도금)	37	4.00	아연도금 t1.6, W175×L1100 + 차열시트 t5.0	t	6
34	12	방화플래싱 좌우(아연도금)	38	4.00	아연도금 t1.6, W95×L195 + 차열시트 t5.0	t	7
35	12	실란트	13	1.00	KS F 4910 F-12.5E, t3이상, 오버랩3이상	t	8
36	12	지지구조 세라믹단열재	10	2.00	96K, t25, W600, 양면대칭, 철사고정	t	9
46	13	틈새복합시트(상하) 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L1000, 상하×4개	t	1
47	13	틈새복합시트(상하) 세라믹	54	2.00	96K, t25, H150, L1000, 상하×2개	t	2
48	13	틈새복합시트(좌우) 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L180, 좌우×4개	t	3
49	13	틈새복합시트(좌우) 세라믹	54	2.00	96K, t25, H150, L180, 좌우×2개	t	4
50	13	틈새 차열시트	21	4.00	밀도1.2g/cm³, t5.0, W125, L180, 틈새×4개	t	5
51	13	방화플래싱 상하(아연도금)	37	4.00	아연도금 t1.6, W175×L1100 + 차열시트	t	6
52	13	방화플래싱 좌우(아연도금)	38	4.00	아연도금 t1.6, W95×L195 + 차열시트	t	7
53	13	실란트	57	1.00	KS F 4910 F-12.5E	t	8
54	13	지지구조 세라믹단열재	54	2.00	96K, t25, W600, 양면대칭	t	9
\.


--
-- Data for Name: cert_document; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cert_document (cert_doc_id, item_id, supplier_name, supplier_lot, test_institution, cert_number, issued_date, expiry_date, test_items, test_results, is_valid, remarks, file_path, created_at) FROM stdin;
1	5	포스코	2025-A001	KCL 한국건설생활환경시험연구원	KCL-2025-0513	2025-05-13	2026-05-12	항복강도/인장강도	항복 276 N/mm², 인장 358 N/mm²	t	2025년 공인시험	\N	2026-03-30 02:04:06.530234+00
2	8	CERA사	2025-CW-001	KTR 한국화학융합시험연구원	KTR-2025-0801	2025-08-01	2026-07-31	밀도/숏함유량/가열선수축율	밀도 130 kg/m³, 숏 7%, 수축율 1.2%	t	120K 기준 성적서	\N	2026-03-30 02:04:06.530234+00
3	10	CERA사	2025-CW-002	KTR 한국화학융합시험연구원	KTR-2025-0802	2025-08-01	2026-07-31	밀도/숏함유량/가열선수축율	밀도 103 kg/m³, 숏 8%, 수축율 1.5%	t	96K 기준 성적서	\N	2026-03-30 02:04:06.530234+00
4	1	한화솔루션	2025-MB-A01	FITI 시험연구원	FITI-2025-UL001	2025-06-15	2026-06-14	UL94	V-0 등급	t	UL94 공인시험	\N	2026-03-30 02:04:06.530234+00
5	1	한화솔루션	2025-MB-A01	Koptri 한국산업기술시험원	KOP-2025-D001	2025-06-20	2026-06-19	밀도/MI	밀도 0.8 g/cm³, MI 0.923 g/10min	t	밀도/MI 공인시험	\N	2026-03-30 02:04:06.530234+00
6	2	삼화흑연	2025-EG-001	KTR 한국화학융합시험연구원	KTR-2025-EG01	2025-07-10	2026-07-09	체잔분(300um)	체잔분 83%	t	팽창흑연 체잔분 공인시험	\N	2026-03-30 02:04:06.530234+00
7	14	FN테크	2025-FN-001	KCL 한국건설생활환경시험연구원	KCL-2025-FN01	2025-09-01	2026-08-31	인장강도/굴곡강도/충격강도	인장 285 MPa, 굴곡 28 MPa, 충격 27 kJ/m²	t	FN테크 슬리브 물성시험	\N	2026-03-30 02:04:06.530234+00
\.


--
-- Data for Name: certification_master; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.certification_master (cert_id, cert_number, product_group, structure_name, structure_code, install_position, fire_rating, socket_name, cert_area_sqmm, opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, gap_limit_mm, gap_direction, install_qty, sheet_thickness_min, sheet_thickness_prod, cw_density_min, cw_density_prod, cert_version, is_active, created_at) FROM stdin;
1	FS-MP25-0310-1	MP	EZ-F.B-POSMAC Duct-VT-01	VT-01	수직벽체	차열 2시간	VT200	2025000	2700	750	2600	650	50	MAX	2	5.0	5.0	120	120	0310	t	2026-03-30 02:04:06.525018+00
2	FS-MP25-0310-2	MP	EZ-F.B-POSMAC Duct-VS-01	VS-01	수직벽체	차열 2시간	VS200+VG200	2025000	2700	750	2600	650	50	MAX	2	5.0	5.0	120	120	0310	t	2026-03-30 02:04:06.525018+00
3	FS-MP25-0310-3	MP	EZ-F.B-POSMAC Duct-VT-049	VT-049	수직벽체	차열 2시간	VM200	675000	1500	450	1400	350	50	MAX	1	5.0	5.0	120	120	0310	t	2026-03-30 02:04:06.525018+00
4	FS-MP25-0310-4	MP	EZ-F.B-POSMAC Duct-VA-064	VA-064	수직벽체	차열 2시간	VM200	850000	1700	500	1600	400	50	MAX	1	5.0	5.0	120	120	0310	t	2026-03-30 02:04:06.525018+00
5	FS-MP24-0310-7	MP	EZ-F.B-POSMAC Duct-VT-064	VT-064	수직벽체	차열 2시간	VM200	850000	1700	500	1600	400	50	MAX	1	5.0	5.0	120	120	0310	t	2026-03-30 02:04:06.525018+00
6	FS-MP25-0910-01	MP	EZ-F.B-POSMAC Duct-VAG-1.69	VAG-1.69	수직벽체	차열 2시간	VTG200	2025000	2700	750	2600	650	50	MAX	2	4.0	5.0	96	120	0910	t	2026-03-30 02:04:06.525018+00
7	FS-MP25-0910-06	MP	EZ-F.B-POSMAC Duct-VTI-064	VTI-064	수직벽체	차열 2시간	VIG200	850000	1700	500	1600	400	50	MAX	1	4.0	5.0	96	120	0910	t	2026-03-30 02:04:06.525018+00
8	FS-MP25-0910-02	MP	EZ-F.B-POSMAC Duct-HAG-1.69	HAG-1.69	수평바닥	차열 2시간	HTG300C	2025000	2700	750	2600	650	80	MAX	2	4.0	5.0	96	120	0910	t	2026-03-30 02:04:06.525018+00
9	FS-MP25-0910-04	MP	EZ-F.B-POSMAC Duct-HTG-1.69	HTG-1.69	수평바닥	차열 2시간	HTG300C	2235600	2760	810	2600	650	80	MAX	2	4.0	5.0	96	120	0910	t	2026-03-30 02:04:06.525018+00
10	FS-MP25-0910-05	MP	EZ-F.B-POSMAC Duct-HTG-064	HTG-064	수평바닥	차열 2시간	HMG300C	985600	1760	560	1600	400	80	MAX	1	4.0	5.0	96	120	0910	t	2026-03-30 02:04:06.525018+00
11	FS-MP25-0910-03	MP	EZ-F.B-POSMAC Duct-HTG(DC)-064	HTG(DC)-064	수평바닥	차열 2시간	HMG300	640000	1600	400	1600	400	0	MAX	1	4.0	5.0	96	120	0910	t	2026-03-30 02:04:06.525018+00
12	FS-BD25-0910-07	BD	EZ-BD-CV-1S(200A)	EZ-BD-CV-1S	수직벽체	차열 2시간	\N	\N	\N	\N	\N	\N	50	MAX	1	\N	\N	\N	\N	0910	t	2026-03-30 02:04:06.525018+00
13	FS-BD25-0910-08	BD	EZ-BD-RV-3S(025M)	EZ-BD-RV-3S	수직벽체	차열 2시간	\N	\N	\N	\N	\N	\N	68	MAX	1	\N	\N	\N	\N	0910	t	2026-03-30 02:04:06.525018+00
14	FS-NP24-1112-2	NP	EZ-FN-P100	EZ-FN-P100	수평바닥	차열 2시간	\N	\N	\N	\N	\N	\N	\N	MAX	1	\N	\N	\N	\N	NP24	t	2026-03-30 02:04:06.525018+00
\.


--
-- Data for Name: certification_rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.certification_rule (rule_id, cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) FROM stdin;
1	1	AREA	2025000.00	MAX	\N	\N	mm²	개구부 면적 2700×750 = 2,025,000 mm²
2	1	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
3	1	THICKNESS	5.00	MIN	5.00	\N	mm	차열시트 두께 5.0mm 이상 (0310)
4	1	DENSITY	120.00	MIN	120.00	\N	kg/m³	CW 밀도 120kg/m³ 이상 (0310)
5	2	AREA	675000.00	MAX	\N	\N	mm²	개구부 면적 1500×450 = 675,000 mm²
6	2	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
7	2	THICKNESS	5.00	MIN	5.00	\N	mm	차열시트 두께 5.0mm 이상 (0310)
8	2	DENSITY	120.00	MIN	120.00	\N	kg/m³	CW 밀도 120kg/m³ 이상 (0310)
9	3	AREA	850000.00	MAX	\N	\N	mm²	개구부 면적 1700×500 = 850,000 mm²
10	3	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
11	3	THICKNESS	5.00	MIN	5.00	\N	mm	차열시트 두께 5.0mm 이상 (0310)
12	3	DENSITY	120.00	MIN	120.00	\N	kg/m³	CW 밀도 120kg/m³ 이상 (0310)
13	4	AREA	850000.00	MAX	\N	\N	mm²	개구부 면적 1700×500 = 850,000 mm²
14	4	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
15	4	THICKNESS	5.00	MIN	5.00	\N	mm	차열시트 두께 5.0mm 이상 (0310)
16	4	DENSITY	120.00	MIN	120.00	\N	kg/m³	CW 밀도 120kg/m³ 이상 (0310)
17	5	AREA	2025000.00	MAX	\N	\N	mm²	개구부 면적 2700×750 = 2,025,000 mm²
18	5	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
19	5	THICKNESS	4.00	MIN	5.00	\N	mm	차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)
20	5	DENSITY	96.00	MIN	120.00	\N	kg/m³	CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)
21	6	AREA	850000.00	MAX	\N	\N	mm²	개구부 면적 1700×500 = 850,000 mm²
22	6	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
23	6	THICKNESS	4.00	MIN	5.00	\N	mm	차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)
24	6	DENSITY	96.00	MIN	120.00	\N	kg/m³	CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)
25	7	AREA	2025000.00	MAX	\N	\N	mm²	개구부 면적 2700×750 = 2,025,000 mm²
26	7	GAP	80.00	MAX	\N	\N	mm	틈새간격 80mm 이하 (수평)
27	7	THICKNESS	4.00	MIN	5.00	\N	mm	차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)
28	7	DENSITY	96.00	MIN	120.00	\N	kg/m³	CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)
29	8	AREA	2235600.00	MAX	\N	\N	mm²	개구부 면적 2760×810 = 2,235,600 mm²
30	8	GAP	80.00	MAX	\N	\N	mm	틈새간격 80mm 이하 (수평)
31	8	THICKNESS	4.00	MIN	5.00	\N	mm	차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)
32	8	DENSITY	96.00	MIN	120.00	\N	kg/m³	CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)
33	9	AREA	985600.00	MAX	\N	\N	mm²	개구부 면적 1760×560 = 985,600 mm²
34	9	GAP	80.00	MAX	\N	\N	mm	틈새간격 80mm 이하 (수평)
35	9	THICKNESS	4.00	MIN	5.00	\N	mm	차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)
36	9	DENSITY	96.00	MIN	120.00	\N	kg/m³	CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)
37	10	AREA	640000.00	MAX	\N	\N	mm²	개구부 면적 1600×400 = 640,000 mm²
38	10	GAP	0.00	MAX	\N	\N	mm	틈새간격 0mm (DC 타설형)
39	10	THICKNESS	4.00	MIN	5.00	\N	mm	차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)
40	10	DENSITY	96.00	MIN	120.00	\N	kg/m³	CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)
41	11	GAP	50.00	MAX	\N	\N	mm	틈새간격 50mm 이하
42	12	GAP	68.00	MAX	\N	\N	mm	틈새간격 67.5~118mm
43	13	PIPE	100.00	MAX	\N	\N	A	배관 규격 100A 이하
\.


--
-- Data for Name: closing_adjustment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.closing_adjustment (adj_id, closing_id, ci_id, item_id, lot_id, lot_number, adj_type, adj_qty, reason, process_zone, approver_name, status, requested_by, requested_at, approved_at, applied_at, inv_id, note) FROM stdin;
\.


--
-- Data for Name: closing_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.closing_item (ci_id, closing_id, item_id, lot_id, lot_number, item_category, process_zone, system_qty, physical_qty, difference, diff_rate, unit, count_status, counted_by, counted_at, verified_by, verified_at, note, created_at) FROM stdin;
\.


--
-- Data for Name: compounding_recipe; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compounding_recipe (recipe_id, recipe_name, recipe_code, batch_size, batch_unit, is_certified, is_active, created_at) FROM stdin;
1	인정배합원료 300	MIX-CERT-300	300.00	kg	t	t	2026-03-30 02:04:12.284036+00
\.


--
-- Data for Name: compounding_recipe_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compounding_recipe_item (recipe_item_id, recipe_id, item_id, qty, ratio, sort_order) FROM stdin;
1	1	1	150.00	50.00	1
2	1	2	60.00	20.00	2
3	1	3	45.00	15.00	3
4	1	4	45.00	15.00	4
\.


--
-- Data for Name: defect_record; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.defect_record (defect_id, wo_id, log_id, lot_number, process_code, defect_type, qty, unit, weight, description, disposition, disposal_report_id, recorded_by, created_at) FROM stdin;
\.


--
-- Data for Name: disposal_report; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.disposal_report (report_id, report_number, defect_ids, total_qty, total_weight, disposal_method, reason, created_by, approved_by, status, created_at, approved_at) FROM stdin;
\.


--
-- Data for Name: inspection; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection (insp_id, insp_type, form_code, wo_id, lot_id, cert_id, sampling_n, accept_c, result, inspector, inspected_at, shipped_at, remarks, cert_doc_id, ks_verified, cert_doc_verified) FROM stdin;
1	INCOMING	D103-1	\N	1	\N	3	0	PENDING	\N	\N	\N	\N	\N	f	f
\.


--
-- Data for Name: inspection_detail; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inspection_detail (detail_id, insp_id, item_no, quality_item, check_item, check_method, cert_standard, prod_standard, measured_n1, measured_n2, measured_n3, is_applicable, item_result, unit) FROM stdin;
1	1	1	외관	외관 (투명 그래뉼)	육안	\N	\N	\N	\N	\N	t	NA	OK/NG
2	1	2	MI	Melt Index (41~49)	성적서	\N	\N	\N	\N	\N	t	NA	g/10min
3	1	3	VA함량	VA 함량	성적서	\N	\N	\N	\N	\N	t	NA	%
4	1	4	공인시험	MI/내약품성 공인시험	공인기관	\N	\N	\N	\N	\N	t	NA	-
\.


--
-- Data for Name: inventory_closing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_closing (closing_id, closing_year, closing_month, closing_date, status, created_by, created_at, finalized_at, notes) FROM stdin;
\.


--
-- Data for Name: inventory_transaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_transaction (inv_id, item_id, lot_id, txn_type, txn_date, qty, balance, purpose, ref_wo_id, ref_lot_number, worker, confirmed_by, source_lot, linked_lot, issuer_name, verifier_name, created_at) FROM stdin;
\.


--
-- Data for Name: item_master; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_master (item_id, item_code, item_name, item_category, item_subcategory, spec, unit, cert_min_density, cert_min_thickness, cert_min_mass, production_value, tolerance_plus, value_direction, safety_stock, is_active, ks_type, ks_number, insp_form_code, insp_spec_ref, cert_test_items, cert_test_cycle, roll_length_m, roll_spec) FROM stdin;
16	SA-MIX-MB	인정배합	SA	배합	C-601 준수	kg	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
19	SA-EXT-5125	압출 플래싱차열시트 5T×125(I형)	SA	압출	5T×125mm	m	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
17	SA-EXT-5190	압출(5T-190) 소켓용	SA	압출	5T×190mm	m	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
20	SA-EXT-4125	압출 플래싱차열시트 4T×125(Z형)	SA	압출	4T×125mm	m	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
5	SM-GI-I	강재류 아연도금강판(I형)	SM	강재류	W125, L1000, t0.5	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	KS	KS D 3030	D121-4	EZC-D121 Rev3	항복강도/인장강도	1회/년	\N	\N
2202	SM-SCREW	피스(#8×64mm)	SM	고정자재	#8×64mm 드릴링 스크류, 플래싱 고정용	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
18	SA-EXT-65415	압출(6.5T-415) FN용	SA	압출	6.5T×415mm	m	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
21	SA-CUT-SK	재단(소켓용)	SA	재단	규격별	매	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
22	SA-CUT-FL	재단(플래싱용)	SA	재단	규격별	매	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
23	FP-VT01	방화소켓(VT-01)	FP	방화소켓	VT200 벽체	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
24	FP-VS01	방화소켓(VS-01)	FP	방화소켓	VS200+VG200 벽체 2소켓	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
25	FP-VT049	방화소켓(VT-049)	FP	방화소켓	VM200 벽체	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
26	FP-VT064	방화소켓(VT-064)	FP	방화소켓	VM200 벽체	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
27	FP-VA064	방화소켓(VA-064)	FP	방화소켓	VM200 벽체 4면	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3330	FP-HAG169	방화소켓(HAG-1.69)	FP	SOCKET	HTG300C 바닥 2개조립	ea	\N	\N	\N	\N	\N	\N	0.00	f	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
41	FP-STR	내화채움구조체(발주별 LOT)	FP	구조체	발주별	SET	\N	\N	\N	\N	\N	\N	0.00	f	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3	RM-EA	EVA-EA33045	RM	배합원료	배합원료	kg	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	D103-1	EZC-D103 Rev0	MI/내약품성	1회/년	\N	\N
4	RM-EP	EVA-EP100	RM	배합원료	배합원료	kg	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	D104-1	EZC-D104 Rev0	겉보기밀도/pH	1회/년	\N	\N
2	RM-EG50	팽창흑연 #50	RM	배합원료	배합원료	kg	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	D102-1	EZC-D102 Rev1	체잔분(300um)	1회/년	\N	\N
1	RM-MB	난연컴파운드(PE3005MB)	RM	배합원료	배합원료	kg	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	D101-1	EZC-D101 Rev1	UL94/밀도/MI	1회/년	\N	\N
5550	SM-GI-I-10	강재류 아연도금강판(I형) L1000	SM	강재류	SGCC t0.5, W125×L1000	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
5551	SM-GI-Z-10	강재류 아연도금강판(Z형) L1000	SM	강재류	SGCC t0.5, W215×L1000	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
5552	SM-GI-L-10	강재류 아연도금강판(L형) L1000	SM	강재류	SGCC t0.5, W185×L1000	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3468	SM-SK-BODY	금속소켓 본체(아연도금강판)	SM	강재류	아연도금강판 SGCC t1.6, 소켓본체	EA	\N	1.6	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3908	SM-CW-96-25W2	세라믹차열재 96K t25 W200	SM	세라믹차열재	밀도96kg/m³, t25, W200 (블랭킷 벽체)	M	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3909	SM-CW-96-25W3	세라믹차열재 96K t25 W300	SM	세라믹차열재	밀도96kg/m³, t25, W300 (블랭킷 바닥)	M	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3910	SM-CW-96-50	세라믹차열재 96K t50 W600	SM	세라믹차열재	밀도96kg/m³, t50, W600 (지지구조)	M	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
39	FP-TS	틈새복합시트(200×1000)	FP	틈새시트	200×1000	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
40	FP-FN100	내화충전발포소켓 100A	FP	발포소켓	100A	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3911	SM-CW-96-38	세라믹차열재 96K t38 W600	SM	세라믹차열재	밀도96kg/m³, t38, W600 (지지구조 1.69)	M	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3331	SM-BRK-RF	소켓 보강대	SM	BRACKET	SGCC, 너비30×높이20, t1.6이상 (바닥입상용)	ea	\N	\N	\N	\N	\N	\N	0.00	f	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
49	SM-STL-I	강재류(I형)	SM	강재류	W125×L1000, T:0.5	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
8	SM-CW128	세라믹울 128K	SM	세라믹울	소켓조립 전용(재단)	EA	120.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	D124-3	EZC-D124 Rev4	밀도/숏함유량/가열선수축율	1회/년	\N	\N
9	SM-CW100	세라믹울 100K	SM	세라믹울	관통부 단열재	EA	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	D124-1	EZC-D124 Rev4	밀도/숏함유량/가열선수축율	1회/년	\N	\N
10	SM-CW96	세라믹울 96K	SM	세라믹울	지지구조 단열재	EA	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	D124-1	EZC-D124 Rev4	밀도/숏함유량/가열선수축율	1회/년	\N	\N
11	SM-GW24	글라스울 24K	SM	글라스울	밀도24kg/m³, t25	EA	24.00	\N	\N	\N	\N	MIN	0.00	t	KS	KS L 9102	D122-1	EZC-D122 Rev1	열전도율/열간수축온도	1회/년	\N	\N
12	SM-PE	PE보온재	SM	보온재	관통부 보온	EA	\N	\N	\N	\N	\N	\N	0.00	t	KS	KS M 3862	D123-1	EZC-D123 Rev0	밀도/열전도율	1회/년	\N	\N
13	SM-SL	실리콘 실란트	SM	밀봉재	KS F 4910 F-12.5E	EA	\N	\N	\N	\N	\N	\N	0.00	f	KS	KS F 4910	D125-1	EZC-D125 Rev0	탄성복원력/체적손실	1회/년	\N	\N
14	SM-FN	발포소켓 몸체(FN테크)	SM	발포소켓	100A용	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	D128-1	EZC-D128 Rev0	인장강도/굴곡강도/충격강도	1회/년	\N	\N
15	SM-SP	보호철판	SM	보호철판	소켓 보호용	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	D129-1	EZC-D129 Rev0	경도/인장강도	1회/년	\N	\N
50	SM-STL-L	강재류(L형)	SM	강재류	W185×L1000, T:0.5	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
51	SM-STL-Z	강재류(Z형)	SM	강재류	W215×L1000, T:0.5	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
52	SM-CW-128	세라믹차열재(128K)	SM	세라믹차열재	밀도128kg/m³, t50, W600	M	128.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
53	SM-CW-100	세라믹차열재(100K)	SM	세라믹차열재	밀도100kg/m³, t50, W600	M	100.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
54	SM-CW-96	세라믹차열재(96K)	SM	세라믹차열재	밀도96kg/m³, t25~50, W200~600	M	96.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
55	SM-GW-24	글라스울(24K)	SM	글라스울	밀도24kg/m³, t25, W1400	M	24.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
56	SM-PE-INS	PE보온재	SM	보온재	관통부 보온	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3912	SM-CW-128-25	세라믹차열재 128K t25 W200	SM	세라믹차열재	밀도128kg/m³, t25, W200 (블랭킷)	M	128.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3913	SM-GW-24-14	글라스울 24K W1400	SM	글라스울	밀도24kg/m³, t25, W1400	M	24.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
3914	SM-GW-24-10	글라스울 24K W1000	SM	글라스울	밀도24kg/m³, t25, W1000	M	24.00	\N	\N	\N	\N	MIN	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
63	SA-EXT-5125I	압출(5T-125) I형	SA	압출	5T×125mm 플래싱	m	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
64	SA-EXT-4125Z	압출(4T-125) Z형	SA	압출	4T×125mm 플래싱	m	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
29	FP-VTI064	방화소켓(VTI-064)	FP	방화소켓	VIG200 벽체	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
30	FP-HTG169	방화소켓(HTG-1.69)	FP	방화소켓	HTG300C 바닥 2개조립	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
32	FP-HTGDC064	방화소켓(HTG(DC)-064)	FP	방화소켓	HMG300 바닥 DC형	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
33	FP-FL-I	플래싱(I형)	FP	플래싱	W125×L1000	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
34	FP-FL-Z	플래싱(Z형)	FP	플래싱	W170×L1000	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
35	FP-FL-L	플래싱(L형)	FP	플래싱	W185×L1000	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
36	FP-BD-FL-SUS	BD플래싱(SUS304)	FP	BD플래싱	SUS304 t0.5, W190×L380	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
37	FP-BD-FL-GI-L	BD플래싱(아연도금,대형)	FP	BD플래싱	아연도금 t1.6, W175×L1100	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
38	FP-BD-FL-GI-S	BD플래싱(아연도금,소형)	FP	BD플래싱	아연도금 t1.6, W95×L195	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
57	SM-SIL	실란트	SM	밀봉재	실리콘실란트	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
58	SM-FN-SK	발포소켓(FN Tech)	SM	발포소켓	규격별	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
59	SM-GP	고정자재	SM	고정자재	아연도금강판 SGCC, L1000×H200×t0.5	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
5553	SM-GP-10	고정자재 L1000	SM	고정자재	아연도금강판 SGCC t0.5, L1000	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
28	FP-VAG169	방화소켓(VAG-1.69)	FP	방화소켓	VTG200 벽체 2개조립	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
31	FP-HTG064	방화소켓(HTG-064)	FP	방화소켓	HMG300C 바닥	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
83	FP-GAP-SH	틈새복합시트	FP	틈새시트	200×1000	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
84	FP-FN-100A	발포소켓(100A)	FP	발포소켓	100A	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
85	FP-FN-75A	발포소켓(75A)	FP	발포소켓	75A	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
86	FP-STRUCT	구조체	FP	구조체	발주별 SET	SET	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
2428	SM-BRK-TB	소켓 브라켓(상/하)	SM	브라켓	SGCC, H15×W190×L1265, t0.6이상	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
2429	SM-BRK-MD	소켓 브라켓(중앙)	SM	브라켓	SGCC, H10×W190×L1265, t0.6이상	EA	\N	\N	\N	\N	\N	\N	0.00	t	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
6	SM-GI-L	강재류 아연도금강판(L형)	SM	강재류	W185, L1000, t0.5	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	KS	KS D 3030	D121-4	EZC-D121 Rev3	항복강도/인장강도	1회/년	\N	\N
7	SM-GI-Z	강재류 아연도금강판(Z형)	SM	강재류	W215, L1000, t0.5	EA	\N	0.5	\N	\N	\N	MIN	0.00	t	KS	KS D 3030	D121-4	EZC-D121 Rev3	항복강도/인장강도	1회/년	\N	\N
3332	SM-BRK-CP	결합철판	SM	BRACKET	SGCC 60폭, t0.6이상 (VAG용 소켓 결합)	ea	\N	\N	\N	\N	\N	\N	0.00	f	NON_KS	\N	\N	\N	\N	1회/년	\N	\N
\.


--
-- Data for Name: loss_record; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loss_record (loss_id, wo_id, log_id, process_code, lot_number, planned_input, actual_input, actual_output, loss_qty, loss_rate, weighed_qty, remarks, recorded_by, created_at) FROM stdin;
\.


--
-- Data for Name: lot_genealogy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lot_genealogy (genealogy_id, parent_lot_id, child_lot_id, consumed_qty, component_position) FROM stdin;
\.


--
-- Data for Name: lot_properties; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lot_properties (prop_id, lot_number, process_code, log_id, inspection_id, density, density_unit, thickness, width, length_calculated, input_weight_kg, output_weight_kg, loss_weight_kg, output_length_m, loss_length_m, theoretical_loss_kg, actual_vs_theoretical_diff, recorded_by, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: lot_transaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lot_transaction (lot_id, lot_number, lot_type, item_id, wo_id, qty, unit, supplier_lot, inspection_lot, inspection_result, cert_compliant, status, remaining_qty, location, serial_start, serial_end, base_lot, created_at) FROM stdin;
1	IN-260331-001	IN	3	\N	22.73	kg	\N	EZ-260331-001	PENDING	\N	ACTIVE	22.73	\N	\N	\N	\N	2026-03-31 14:07:07.415815+00
\.


--
-- Data for Name: order_bom_result; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_bom_result (result_id, order_id, order_item_id, item_id, item_code, item_name, item_category, required_qty, unit, current_stock, shortage_qty, component_name, spec_detail, calc_note, created_at, bom_level, parent_group, source_type, group_sort) FROM stdin;
1	1	\N	27	FP-VA064	방화소켓(VA-064)	FP	8.00	EA	0.00	8.00	금속소켓 본체(VA-064)	아연도금강판 t1.6, 600×700×200	소켓 수량 = 1개 × 8세트 = 8	2026-03-31 03:10:31.301449+00	1	SOCKET	MANUFACTURE	1
2	1	\N	21	SA-CUT-SK	재단(소켓용)	SA	110.00	매	0.00	110.00	차열시트 내부(상하)(VA-064), 차열시트 내부(좌우)(VA-064), 차열시트 외부(상하)(VA-064), 차열시트 외부(좌우)(VA-064), 차열시트 내부(HTG-1.69)	밀도1.2g/cm³, 두께5mm, 190×595 | 밀도1.2g/cm³, 두께5mm, 190×670 | 밀도1.2g/cm³, 두께5mm, 190×660 | 밀도1.2g/cm³, 두께5mm, 190×700 | 밀도1.2g/cm³, 두께5mm, 255×1195	상하4EA, L=[W]-5=600-5=595mm × 8세트 = 32\n좌우4EA, L=[H]-30=700-30=670mm × 8세트 = 32\n외부상하2EA, L=660mm × 8세트 = 16\n외부좌우2EA, L=700mm × 8세트 = 16\n내부14EA, L=[W]-5=1200-5=1195mm × 1세트 = 14	2026-03-31 03:10:31.301449+00	2	SOCKET	MANUFACTURE	10
3	1	\N	2428	SM-BRK-TB	소켓 브라켓(상/하)	SM	40.00	EA	0.00	40.00	소켓 브라켓(상/하)(VA-064), 소켓 브라켓(상/하)(HTG-1.69)	SGCC, H15×W190×L1265, t0.6이상 | SGCC, H15×W190×L1265, t0.6이상	소켓 1개 × 상하4EA/소켓 = 4EA × 8세트 = 32\n소켓 2개 × 상하4EA/소켓 = 8EA × 1세트 = 8	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	40
4	1	\N	3912	SM-CW-128-25	세라믹차열재 128K t25 W200	SM	21.76	M	0.00	21.76	세라믹블랭킷(상하)(VA-064), 세라믹블랭킷(좌우)(VA-064)	밀도128kg/m³(기준≥120), 두께25mm, W200, L660 | 밀도128kg/m³(기준≥120), 두께25mm, W200, L700	상하2EA × 660mm ÷ 1000 = 1.32M × 8세트 = 10.56\n좌우2EA × 700mm ÷ 1000 = 1.4M × 8세트 = 11.2	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	3
5	1	\N	33	FP-FL-I	플래싱(I형)	FP	56.00	EA	0.00	56.00	방화플래싱(I형)(VA-064)	강판0.5t + 차열시트5t, W125, L1000, 양면시공	상하(W+250)=850×2 + 좌우(H)=700×2 = 3100mm/면 → 3.1세트/면 × 양면2 = 6.2세트 × 로스10% = 6.82 → 올림 7EA × 8세트 = 56	2026-03-31 03:10:31.301449+00	1	FLASHING	MANUFACTURE	2
6	1	\N	5550	SM-GI-I-10	강재류 아연도금강판(I형) L1000	SM	56.00	EA	0.00	56.00	플래싱용 아연도금강판(I형)(VA-064)	아연도금강판 SGCC(KS D 3506), t0.5, W125, L1000	플래싱 7세트 × 강판1장/세트 = 7장 × 8세트 = 56	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	40
7	1	\N	22	SA-CUT-FL	재단(플래싱용)	SA	67.00	매	0.00	67.00	플래싱용 차열시트(I형)(VA-064), 플래싱용 차열시트(Z형)(HTG-1.69)	밀도1.2g/cm³, t5mm, W125, L1000 | 밀도1.2g/cm³, t5mm, W170, L1000	플래싱 7세트 × 차열시트1장/세트 = 7장 × 8세트 = 56\n플래싱 11세트 × 차열시트1장/세트 = 11장 × 1세트 = 11	2026-03-31 03:10:31.301449+00	2	FLASHING	MANUFACTURE	20
8	1	\N	3913	SM-GW-24-14	글라스울 24K W1400	SM	89.12	M	0.00	89.12	글라스울 덕트보온재(24K)(VA-064), 지지구조 그라스울2단(24K)(VA-064), 글라스울 덕트보온재(24K)(HTG-1.69), 지지구조 그라스울1단(24K)(HTG-1.69)	밀도24kg/m³, 두께25mm, W1400(롤폭) | 밀도24kg/m³, 두께25mm, W1400, 양면대칭 | 밀도24kg/m³, 두께25mm, W1400(롤폭) | 밀도24kg/m³, 두께25mm, W1400	(600+700)×2×4면÷1000÷1.4=7.43M × 8세트 = 59.44\n600mm×4면÷1000÷1.4=1.71M × 8세트 = 13.68\n(1200+1000)×2×4면÷1000÷1.4=12.57M × 1세트 = 12.57\n1200mm×4면÷1000÷1.4=3.43M × 1세트 = 3.43	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	3
9	1	\N	3910	SM-CW-96-50	세라믹차열재 96K t50 W600	SM	32.00	M	0.00	32.00	지지구조 세라믹차열재1단(96K)(VA-064)	밀도96kg/m³, 두께50mm, W600, 양면대칭	배관길이600mm × 4면 ÷ 1000 ÷ 0.6(롤폭) = 4M × 8세트 = 32	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	3
10	1	\N	57	SM-SIL	실란트	SM	8.00	EA	0.00	8.00	실리콘 실란트(VA-064)	KS F 4910 F-12.5E, t3이상, 오버랩3이상	둘레2600mm ÷ 3000mm/EA × 1소켓 = 1EA × 8세트 = 8	2026-03-31 03:10:31.301449+00	1	SEALANT	PURCHASE	5
11	1	\N	30	FP-HTG169	방화소켓(HTG-1.69)	FP	2.00	EA	0.00	2.00	금속소켓 본체(HTG-1.69)	아연도금강판 t1.6, 600×1000×300	소켓 수량 = 2개 × 1세트 = 2	2026-03-31 03:10:31.301449+00	1	SOCKET	MANUFACTURE	1
12	1	\N	2429	SM-BRK-MD	소켓 브라켓(중앙)	SM	4.00	EA	0.00	4.00	소켓 브라켓(중앙)(HTG-1.69)	SGCC, H10×W190×L1265, t0.6이상	소켓 2개 × 중앙2EA/소켓 = 4EA × 1세트 = 4	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	40
13	1	\N	3909	SM-CW-96-25W3	세라믹차열재 96K t25 W300	SM	4.52	M	0.00	4.52	세라믹블랭킷(상하)(HTG-1.69), 세라믹블랭킷(좌우)(HTG-1.69)	밀도96kg/m³(기준≥96), 두께25mm, W300, L1260 | 밀도96kg/m³(기준≥96), 두께25mm, W300, L1000	상하2EA × 1260mm ÷ 1000 = 2.52M × 1세트 = 2.52\n좌우2EA × 1000mm ÷ 1000 = 2M × 1세트 = 2	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	3
14	1	\N	34	FP-FL-Z	플래싱(Z형)	FP	11.00	EA	0.00	11.00	방화플래싱(Z형)(HTG-1.69)	강판0.5t + 차열시트5t, W170, L1000	Z형: 둘레4400÷1000=ROUNDUP→5 × 양면2 = 10EA × 로스10% = 11EA × 1세트 = 11	2026-03-31 03:10:31.301449+00	1	FLASHING	MANUFACTURE	3
15	1	\N	5551	SM-GI-Z-10	강재류 아연도금강판(Z형) L1000	SM	11.00	EA	0.00	11.00	플래싱용 아연도금강판(Z형)(HTG-1.69)	아연도금강판 SGCC(KS D 3506), t0.5, W170, L1000	플래싱 11세트 × 강판1장/세트 = 11장 × 1세트 = 11	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	40
16	1	\N	3911	SM-CW-96-38	세라믹차열재 96K t38 W600	SM	24.00	M	0.00	24.00	지지구조 세라믹차열재2단(96K)(HTG-1.69), 지지구조 세라믹차열재3단(96K)(HTG-1.69), 지지구조 세라믹차열재4단(96K)(HTG-1.69)	밀도96kg/m³, 두께38mm, W600 | 밀도96kg/m³, 두께38mm, W600 | 밀도96kg/m³, 두께38mm, W600	1200mm×4면÷1000÷0.6=8M (2단) × 1세트 = 8\n1200mm×4면÷1000÷0.6=8M (3단) × 1세트 = 8\n1200mm×4면÷1000÷0.6=8M (4단) × 1세트 = 8	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	3
17	1	\N	83	FP-GAP-SH	틈새복합시트	FP	10.00	EA	0.00	10.00	틈새복합시트(200H)(HTG-1.69)	200×1000, 차열시트+세라믹블랭킷	둘레4400÷1000=ROUNDUP→5 × 양면2 = 10EA × 1세트 = 10	2026-03-31 03:10:31.301449+00	1	GAP_SHEET	MANUFACTURE	2
18	1	\N	5553	SM-GP-10	고정자재 L1000	SM	10.00	EA	0.00	10.00	고정자재(틈새시트 이탈방지)(HTG-1.69)	아연도금강판 SGCC, L1000×H200×t0.5	틈새복합시트 10EA × 1:1 = 10EA × 1세트 = 10	2026-03-31 03:10:31.301449+00	1	FIXING	PURCHASE	4
19	1	\N	3468	SM-SK-BODY	금속소켓 본체(아연도금강판)	SM	12.00	EA	0.00	12.00	금속소켓 본체(product_bom 전개), 금속소켓 본체(product_bom 전개), 금속소켓 본체(product_bom 전개)	SGCC t1.6, W1700×H500×높이200mm (VA-064 VM200) | SGCC t1.6, W1320×H750×높이300mm (HAG-1.69 HTG300C) ×2개조립 | SGCC t1.6, W1350×H810×높이300mm (HTG-1.69 HTG300C) ×2개조립	방화소켓(VA-064) 8EA × 금속소켓 본체 1EA/소켓 = 8\n방화소켓(HTG-1.69) 2EA × 금속소켓 본체 1EA/소켓 = 2\n방화소켓(HTG-1.69) 2EA × 금속소켓 본체 1EA/소켓 = 2	2026-03-31 03:10:31.301449+00	1	SUPPORT	PURCHASE	40
20	1	\N	17	SA-EXT-5190	압출(5T-190) 소켓용	SA	126.50	m	0.00	126.50	압출 차열시트 5T×190(소켓용)(역전개)	재단(소켓용) → 압출 차열시트 5T×190(소켓용)	110매 ÷ 1/배치 = 110.00배치 × 1.0000roll × 로스15% = 126.5	2026-03-31 03:10:31.301449+00	2	SOCKET	MANUFACTURE	10
21	1	\N	16	SA-MIX-MB	인정배합	SA	255.68	kg	0.00	255.68	인정배합원료(배합물)(역전개), 인정배합원료(배합물)(역전개), 인정배합원료(배합물)(역전개)	압출(5T-190) 소켓용 → 인정배합원료(배합물) | 압출 플래싱차열시트 4T×125(Z형) → 인정배합원료(배합물) | 압출 플래싱차열시트 5T×125(I형) → 인정배합원료(배합물)	126.5m × 1.14kg/M = 144.2kg ÷ 300kg/배치 = 0.48배치 × 300.0000kg × 로스3% = 148.54\n77.05m × 0.60kg/M = 46.2kg ÷ 300kg/배치 = 0.15배치 × 300.0000kg × 로스3% = 47.62\n77.05m × 0.75kg/M = 57.8kg ÷ 300kg/배치 = 0.19배치 × 300.0000kg × 로스3% = 59.52	2026-03-31 03:10:31.301449+00	2	SOCKET	MANUFACTURE	10
22	1	\N	1	RM-MB	난연컴파운드(PE3005MB)	RM	75.76	kg	0.00	75.76	난연컴파운드 PE3005MB(역전개)	인정배합 → 난연컴파운드 PE3005MB	148.54kg ÷ 300/배치 = 0.50배치 × 150.0000kg × 로스2% = 75.76	2026-03-31 03:10:31.301449+00	3	PROCESS_REVERSE	PURCHASE	99
23	1	\N	2	RM-EG50	팽창흑연 #50	RM	30.30	kg	0.00	30.30	팽창흑연 #50(역전개)	인정배합 → 팽창흑연 #50	148.54kg ÷ 300/배치 = 0.50배치 × 60.0000kg × 로스2% = 30.3	2026-03-31 03:10:31.301449+00	3	PROCESS_REVERSE	PURCHASE	99
24	1	\N	3	RM-EA	EVA-EA33045	RM	22.73	kg	0.00	22.73	EVA-EA33045(역전개)	인정배합 → EVA-EA33045	148.54kg ÷ 300/배치 = 0.50배치 × 45.0000kg × 로스2% = 22.73	2026-03-31 03:10:31.301449+00	3	PROCESS_REVERSE	PURCHASE	99
25	1	\N	4	RM-EP	EVA-EP100	RM	22.73	kg	0.00	22.73	EVA-EP100(역전개)	인정배합 → EVA-EP100	148.54kg ÷ 300/배치 = 0.50배치 × 45.0000kg × 로스2% = 22.73	2026-03-31 03:10:31.301449+00	3	PROCESS_REVERSE	PURCHASE	99
26	1	\N	20	SA-EXT-4125	압출 플래싱차열시트 4T×125(Z형)	SA	77.05	m	0.00	77.05	압출 플래싱차열시트 4T×125(Z형)(역전개)	재단(플래싱용) → 압출 플래싱차열시트 4T×125(Z형)	67매 ÷ 1/배치 = 67.00배치 × 1.0000roll × 로스15% = 77.05	2026-03-31 03:10:31.301449+00	2	FLASHING	MANUFACTURE	20
27	1	\N	19	SA-EXT-5125	압출 플래싱차열시트 5T×125(I형)	SA	77.05	m	0.00	77.05	압출 플래싱차열시트 5T×125(I형)(역전개)	재단(플래싱용) → 압출 플래싱차열시트 5T×125(I형)	67매 ÷ 1/배치 = 67.00배치 × 1.0000roll × 로스15% = 77.05	2026-03-31 03:10:31.301449+00	2	FLASHING	MANUFACTURE	20
\.


--
-- Data for Name: process_bom; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.process_bom (bom_id, process_code, bom_name, bom_code, cert_id, output_item_id, output_qty, output_unit, loss_rate, description, is_active, created_at) FROM stdin;
1	MIX	인정배합 차열시트 배합물	BOM-MIX-CERT-300	\N	16	300.00	kg	2.00	배합 공정 BOM (300kg 1배치)	t	2026-03-30 02:04:12.295865+00
2	EXT	압출 차열시트 5T×190(소켓용)	BOM-EXT-SK-5190	\N	17	300.00	kg	3.00	배합물 300kg 투입 → 5T×190mm 시트 압출. 실측무게(kg) 기록 후 M 환산하여 재고 보관.	t	2026-03-30 02:04:12.297919+00
3	EXT	압출 플래싱시트 5T×125(I형)	BOM-EXT-FL-5125	\N	19	300.00	kg	3.00	배합물 300kg 투입 → 5T×125mm 플래싱시트 압출(I형). 실측무게(kg) → M 환산 재고.	t	2026-03-30 02:04:12.298883+00
4	EXT	압출 플래싱시트 4T×125(Z형)	BOM-EXT-FL-4125	\N	20	300.00	kg	3.00	배합물 300kg 투입 → 4T×125mm 플래싱시트 압출(Z형). 실측무게(kg) → M 환산 재고.	t	2026-03-30 02:04:12.299598+00
5	CUT	재단 소켓용 차열시트	BOM-CUT-SK	\N	21	1.00	ea	15.00	소켓용 차열시트 재단. 압출시트(5T×190) 투입 → 구조별 규격에 맞게 재단. 받침대/상하/좌우/외부시트 등.	t	2026-03-30 02:04:12.300273+00
6	CUT	재단 플래싱용 차열시트 Z형	BOM-CUT-FL-Z	\N	22	1.00	세트	15.00	Z형 방화플래싱용 차열시트 재단. 압출시트(4T×125) 투입 → 개구부 둘레 기준 재단. 로스율 15%(표준재단).	t	2026-03-30 02:04:12.300913+00
7	CUT	재단 플래싱용 차열시트 I형	BOM-CUT-FL-I	\N	22	1.00	세트	15.00	I형 방화플래싱용 차열시트 재단. 압출시트(5T×125) 투입 → I형 규격 재단. 로스율 15%(표준재단).	t	2026-03-30 02:04:12.30162+00
9	SHP	방화플래싱 세트(HTG-1.69용)	BOM-SHP-FL-HTG169	8	\N	1.00	set	0.00	HTG-1.69 방화플래싱 출하 세트	t	2026-03-30 02:04:12.305536+00
10	ASM	방화소켓 VT-049 벽체(소형) 조립	BOM-ASM-VT049	\N	25	1.00	ea	0.00	\N	t	2026-03-30 12:56:46.895536+00
13	ASM	방화소켓 VA-064 벽체 조립	BOM-ASM-VA064	\N	27	1.00	ea	0.00	\N	t	2026-03-30 12:56:46.895536+00
11	ASM	방화소켓 VT-064 벽체 조립	BOM-ASM-VT064	\N	26	1.00	ea	0.00	\N	t	2026-03-30 12:56:46.895536+00
12	ASM	방화소켓 HTG-064 수평바닥 조립	BOM-ASM-HTG	\N	31	1.00	ea	0.00	\N	t	2026-03-30 12:56:46.895536+00
658	ASM	방화소켓 VS-01 벽체 조립	BOM-ASM-VS01	\N	24	2.00	ea	0.00	VS200+VG200 벽체 2소켓	t	2026-03-30 13:12:14.815359+00
660	ASM	방화소켓 VTI-064 벽체 조립	BOM-ASM-VTI064	\N	29	1.00	ea	0.00	VIG200 벽체	t	2026-03-30 13:12:14.815359+00
663	ASM	방화소켓 HTG(DC)-064 수평바닥 조립	BOM-ASM-HTGDC064	\N	32	1.00	ea	0.00	HMG300 바닥 DC형	t	2026-03-30 13:12:14.815359+00
8	ASM	방화소켓 VT-01 벽체(대형) 조립	BOM-ASM-VT01	1	23	2.00	ea	0.00	VT-01 방화소켓 조립 BOM	t	2026-03-30 02:04:12.302284+00
659	ASM	방화소켓 VAG-1.69 벽체 조립	BOM-ASM-VAG169	\N	28	2.00	ea	0.00	1270×650 소켓 2개조립→2600×650. 공식: 개별소켓가로=(개구부가로/2)-30mm(보강대겹침). 결합철판으로 연결. 사용자확인 2026-03-30	t	2026-03-30 13:12:14.815359+00
661	ASM	방화소켓 HAG-1.69 수평바닥 조립	BOM-ASM-HAG169	\N	3330	2.00	ea	0.00	1270×650 소켓 2개조립→2600×650. 공식: 개별소켓가로=(개구부가로/2)-30mm(보강대겹침). VAG와 동일방식. 사용자확인 2026-03-30	t	2026-03-30 13:12:14.815359+00
662	ASM	방화소켓 HTG-1.69 수평바닥 조립	BOM-ASM-HTG169	\N	30	2.00	ea	0.00	1270×650 소켓 2개조립→2600×650. 공식: 개별소켓가로=(개구부가로/2)-30mm(보강대겹침). VAG와 동일방식. 사용자확인 2026-03-30	t	2026-03-30 13:12:14.815359+00
\.


--
-- Data for Name: process_bom_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.process_bom_item (bom_item_id, bom_id, item_id, component_name, qty, unit, spec_detail, is_key_material, sort_order) FROM stdin;
1	1	1	난연컴파운드 PE3005MB	150.0000	kg	\N	t	1
2	1	2	팽창흑연 #50	60.0000	kg	\N	t	2
3	1	3	EVA-EA33045	45.0000	kg	\N	t	3
4	1	4	EVA-EP100	45.0000	kg	\N	t	4
5	2	16	인정배합원료(배합물)	300.0000	kg	1배치=300kg. 밀도 약 1.2g/cm³ 기준 시트 산출. 산출 후 실측무게(kg) → M 환산 재고등록	t	1
6	3	16	인정배합원료(배합물)	300.0000	kg	1배치=300kg → 5T×125mm I형 시트 압출. 산출 실측무게(kg) → M 환산	t	1
7	4	16	인정배합원료(배합물)	300.0000	kg	1배치=300kg → 4T×125mm Z형 시트 압출. 산출 실측무게(kg) → M 환산	t	1
8	5	17	압출 차열시트 5T×190(소켓용)	1.0000	roll	t5.0×W190mm 롤 → 규격별 재단(받침대L1280, 상하L1280, 좌우L305, 외부상하L2660, 외부좌우L650 등)	t	1
9	6	20	압출 플래싱차열시트 4T×125(Z형)	1.0000	roll	t4.0×W125mm 롤 → Z형 개구부 둘레 기준 재단. 1세트=1,000mm	t	1
10	7	19	압출 플래싱차열시트 5T×125(I형)	1.0000	roll	t5.0×W125mm 롤 → I형 규격 재단. 1세트=1,000mm	t	1
12	8	21	내부시트(받침대)	4.0000	ea	t5.0 L1280 W190	t	2
13	8	21	내부시트(상/하)	4.0000	ea	t5.0 L1280 W190	t	3
14	8	21	내부시트(좌/우)	8.0000	ea	t5.0 L305 W190	t	4
22	9	8	세라믹울보드 200H용	1.0000	ea	\N	t	1
23	9	8	세라믹울보드 Z형용	1.0000	ea	\N	t	2
24	9	10	세라믹울블랭킷	1.0000	ea	\N	t	3
25	9	5	아연도금강판 200H용	1.0000	ea	\N	t	4
26	9	7	아연도금강판 Z형용	1.0000	ea	\N	t	5
27	9	\N	타카핀	1.0000	ea	\N	t	6
31	10	21	내부시트(받침대)	2.0000	ea	t5.0 W190 규격별 길이	t	2
32	10	21	내부시트(상/하)	2.0000	ea	t5.0 W190 규격별 길이	t	3
33	10	21	내부시트(좌/우)	4.0000	ea	t5.0 W190 규격별 길이	t	4
34	10	21	외부시트(상/하+CW)	2.0000	ea	t5.0 W190+세라믹울부착	t	5
35	10	21	외부시트(좌/우+CW)	2.0000	ea	t5.0 W190+세라믹울부착	t	6
36	10	10	세라믹울 96K	2.0000	ea	t50 W600, 외부시트 부착용	t	7
37	10	11	글라스울 24K	2.0000	ea	t25 W1400	t	8
38	10	13	실란트	1.0000	ea		t	9
39	10	2428	소켓 브라켓(상/하)	2.0000	ea	SGCC H15×W190×t0.6이상	t	10
40	10	2429	소켓 브라켓(중앙)	1.0000	ea	SGCC H10×W190×t0.6이상	t	11
42	11	21	내부시트(받침대)	2.0000	ea	t5.0 W190 규격별	t	2
43	11	21	내부시트(상/하)	2.0000	ea	t5.0 W190 규격별	t	3
44	11	21	내부시트(좌/우)	4.0000	ea	t5.0 W190 규격별	t	4
45	11	21	외부시트(상/하+CW)	2.0000	ea	t5.0 W190+세라믹울	t	5
46	11	21	외부시트(좌/우+CW)	2.0000	ea	t5.0 W190+세라믹울	t	6
47	11	10	세라믹울 96K	2.0000	ea	t50 W600, 외부시트용	t	7
48	11	11	글라스울 24K	2.0000	ea	t25 W1400	t	8
49	11	13	실란트	1.0000	ea		t	9
50	11	2428	소켓 브라켓(상/하)	2.0000	ea	SGCC H15×W190×t0.6이상	t	10
51	11	2429	소켓 브라켓(중앙)	1.0000	ea	SGCC H10×W190×t0.6이상	t	11
53	12	21	내부시트(받침대)	2.0000	ea	t5.0 W190	t	2
54	12	21	내부시트(상/하)	2.0000	ea	t5.0 W190	t	3
55	12	21	내부시트(좌/우)	4.0000	ea	t5.0 W190	t	4
56	12	21	외부시트(상/하+CW)	2.0000	ea	t5.0 W190+세라믹울	t	5
57	12	21	외부시트(좌/우+CW)	2.0000	ea	t5.0 W190+세라믹울	t	6
58	12	10	세라믹울 96K	2.0000	ea	t50 W600	t	7
59	12	11	글라스울 24K	2.0000	ea	t25 W1400	t	8
60	12	13	실란트	1.0000	ea		t	9
61	12	2428	소켓 브라켓(상/하)	2.0000	ea	SGCC H15×W190×t0.6이상	t	10
62	12	2429	소켓 브라켓(중앙)	1.0000	ea	SGCC H10×W190×t0.6이상	t	11
64	13	21	내부시트(받침대)	2.0000	ea	t5.0 W190	t	2
65	13	21	내부시트(상/하)	2.0000	ea	t5.0 W190	t	3
66	13	21	내부시트(좌/우)	4.0000	ea	t5.0 W190	t	4
67	13	21	외부시트(상/하+CW)	2.0000	ea	t5.0 W190+세라믹울	t	5
68	13	21	외부시트(좌/우+CW)	2.0000	ea	t5.0 W190+세라믹울	t	6
69	13	10	세라믹울 96K	2.0000	ea	t50 W600	t	7
70	13	11	글라스울 24K	2.0000	ea	t25 W1400	t	8
71	13	13	실란트	1.0000	ea		t	9
72	13	2428	소켓 브라켓(상/하)	2.0000	ea		t	10
73	13	2429	소켓 브라켓(중앙)	1.0000	ea		t	11
76	658	21	내부시트(받침대)	4.0000	ea	\N	t	2
18	8	10	세라믹울 96K	4.0000	ea	t50 W600	t	8
19	8	11	글라스울 24K	4.0000	ea	t25 W1400	t	9
20	8	13	실란트	2.0000	ea	\N	t	10
28	8	2428	소켓 브라켓(상/하)	4.0000	ea	SGCC H15×W190×L1265 t0.6이상	t	20
29	8	2429	소켓 브라켓(중앙)	2.0000	ea	SGCC H10×W190×L1265 t0.6이상	t	21
15	8	21	외부시트(상/하+CW)	4.0000	ea	t5.0 L2660 W190 + CW	t	5
16	8	21	외부시트(좌/우+CW)	4.0000	ea	t5.0 L650 W190 + CW	t	6
74	12	3331	보강대	1.0000	ea	\N	t	12
77	658	21	내부시트(상/하)	4.0000	ea	\N	t	3
78	658	21	내부시트(좌/우)	8.0000	ea	\N	t	4
79	658	21	외부시트(상/하+CW)	4.0000	ea	\N	t	5
80	658	21	외부시트(좌/우+CW)	4.0000	ea	\N	t	6
81	658	10	세라믹울 96K	4.0000	ea	\N	t	7
82	658	11	글라스울 24K	4.0000	ea	\N	t	8
83	658	13	실란트	2.0000	ea	\N	t	9
84	658	2428	소켓 브라켓(상/하)	4.0000	ea	\N	t	10
85	658	2429	소켓 브라켓(중앙)	2.0000	ea	\N	t	11
87	659	21	내부시트(받침대)	4.0000	ea	\N	t	2
88	659	21	내부시트(상/하)	4.0000	ea	\N	t	3
89	659	21	내부시트(좌/우)	8.0000	ea	\N	t	4
90	659	21	외부시트(상/하+CW)	4.0000	ea	\N	t	5
91	659	21	외부시트(좌/우+CW)	4.0000	ea	\N	t	6
92	659	10	세라믹울 96K	4.0000	ea	\N	t	7
93	659	11	글라스울 24K	4.0000	ea	\N	t	8
94	659	13	실란트	2.0000	ea	\N	t	9
95	659	2428	소켓 브라켓(상/하)	4.0000	ea	\N	t	10
96	659	2429	소켓 브라켓(중앙)	2.0000	ea	\N	t	11
98	660	21	내부시트(받침대)	2.0000	ea	\N	t	2
99	660	21	내부시트(상/하)	2.0000	ea	\N	t	3
100	660	21	내부시트(좌/우)	4.0000	ea	\N	t	4
101	660	21	외부시트(상/하+CW)	2.0000	ea	\N	t	5
102	660	21	외부시트(좌/우+CW)	2.0000	ea	\N	t	6
103	660	10	세라믹울 96K	2.0000	ea	\N	t	7
104	660	11	글라스울 24K	2.0000	ea	\N	t	8
105	660	13	실란트	1.0000	ea	\N	t	9
106	660	2428	소켓 브라켓(상/하)	2.0000	ea	\N	t	10
107	660	2429	소켓 브라켓(중앙)	1.0000	ea	\N	t	11
109	661	21	내부시트(받침대)	4.0000	ea	\N	t	2
110	661	21	내부시트(상/하)	4.0000	ea	\N	t	3
111	661	21	내부시트(좌/우)	8.0000	ea	\N	t	4
112	661	21	외부시트(상/하+CW)	4.0000	ea	\N	t	5
113	661	21	외부시트(좌/우+CW)	4.0000	ea	\N	t	6
114	661	10	세라믹울 96K	4.0000	ea	\N	t	7
115	661	11	글라스울 24K	4.0000	ea	\N	t	8
116	661	13	실란트	2.0000	ea	\N	t	9
117	661	2428	소켓 브라켓(상/하)	4.0000	ea	\N	t	10
118	661	2429	소켓 브라켓(중앙)	2.0000	ea	\N	t	11
119	661	3331	보강대	2.0000	ea	\N	t	12
121	662	21	내부시트(받침대)	4.0000	ea	\N	t	2
122	662	21	내부시트(상/하)	4.0000	ea	\N	t	3
123	662	21	내부시트(좌/우)	8.0000	ea	\N	t	4
124	662	21	외부시트(상/하+CW)	4.0000	ea	\N	t	5
125	662	21	외부시트(좌/우+CW)	4.0000	ea	\N	t	6
126	662	10	세라믹울 96K	4.0000	ea	\N	t	7
127	662	11	글라스울 24K	4.0000	ea	\N	t	8
128	662	13	실란트	2.0000	ea	\N	t	9
129	662	2428	소켓 브라켓(상/하)	4.0000	ea	\N	t	10
130	662	2429	소켓 브라켓(중앙)	2.0000	ea	\N	t	11
131	662	3331	보강대	2.0000	ea	\N	t	12
133	663	21	내부시트(받침대)	2.0000	ea	\N	t	2
134	663	21	내부시트(상/하)	2.0000	ea	\N	t	3
135	663	21	내부시트(좌/우)	4.0000	ea	\N	t	4
136	663	21	외부시트(상/하+CW)	2.0000	ea	\N	t	5
137	663	21	외부시트(좌/우+CW)	2.0000	ea	\N	t	6
138	663	10	세라믹울 96K	2.0000	ea	\N	t	7
139	663	11	글라스울 24K	2.0000	ea	\N	t	8
140	663	13	실란트	1.0000	ea	\N	t	9
141	663	2428	소켓 브라켓(상/하)	2.0000	ea	\N	t	10
142	663	2429	소켓 브라켓(중앙)	1.0000	ea	\N	t	11
143	663	3331	보강대	1.0000	ea	\N	t	12
144	8	3331	보강대	2.0000	ea	\N	t	12
145	658	3331	보강대	2.0000	ea	\N	t	12
146	659	3332	결합철판	2.0000	ea	\N	t	12
11	8	3468	금속소켓 본체 (아연도금강판)	2.0000	ea	SGCC t1.6, 규격별 전개도 가공. 소켓LOT: YYMMDDGINNN	t	1
30	10	3468	금속소켓 본체(아연도금)	1.0000	ea	SGCC t1.6, 벽체 4면소켓, 소켓LOT: YYMMDDGINNN	t	1
41	11	3468	금속소켓 본체(아연도금)	1.0000	ea	SGCC t1.6, 바닥형 4면소켓, 대형	t	1
52	12	3468	금속소켓 본체(아연도금)	1.0000	ea	SGCC t1.6, 입상형 H300, 소켓LOT: YYMMDDGINNN	t	1
63	13	3468	금속소켓 본체(아연도금)	1.0000	ea	SGCC t1.6, 벽체 VA형	t	1
75	658	3468	금속소켓 본체(아연도금)	2.0000	ea	\N	t	1
86	659	3468	금속소켓 본체(아연도금)	2.0000	ea	\N	t	1
97	660	3468	금속소켓 본체(아연도금)	1.0000	ea	\N	t	1
108	661	3468	금속소켓 본체(아연도금)	2.0000	ea	\N	t	1
120	662	3468	금속소켓 본체(아연도금)	2.0000	ea	\N	t	1
132	663	3468	금속소켓 본체(아연도금)	1.0000	ea	\N	t	1
\.


--
-- Data for Name: process_event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.process_event (event_id, log_id, event_type, worker_id, reason, qty_at_event, created_at) FROM stdin;
\.


--
-- Data for Name: process_issue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.process_issue (issue_id, log_id, wo_id, process_code, lot_number, issue_date, issue_type, severity, description, root_cause, corrective_action, loss_impact_kg, recorded_by, resolved, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: process_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.process_log (log_id, wo_id, process_code, shift, worker_id, status, planned_qty, produced_qty, defect_qty, started_at, completed_at, remarks, created_at, actual_input_qty, loss_qty, loss_rate, bom_id, weighed_input, weighed_output, weighed_loss, inventory_applied, worker_ids, worker_names) FROM stdin;
\.


--
-- Data for Name: product_bom; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_bom (pbom_id, sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, is_active, spec_detail) FROM stdin;
2	3	21	차열시트 내부(받침대)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}/2-15	EA	2	t	t5.0 W190
3	3	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	8.00	{W}/2-15	EA	3	t	t5.0 W190
4	3	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	16.00	{H}/2-20	EA	4	t	t5.0 W190
5	3	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{W}+60	EA	5	t	t5.0 W190+CW200
6	3	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{H}	EA	6	t	t5.0 W190+CW200
7	3	8	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	\N	\N	\N	EA	7	t	CW120K t25 W200
8	3	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	2.00	\N	EA	8	t	C/BAR t1.0
9	4	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	t5.0 W125 L1000
10	4	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	t0.5 W125 L1000
12	8	21	차열시트 내부(받침대)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}/2-15	EA	2	t	밀도1.2g/cm3, t5.0, W190
13	8	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	8.00	{W}/2-15	EA	3	t	밀도1.2g/cm3, t5.0, W190
14	8	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	16.00	{H}/2-20	EA	4	t	밀도1.2g/cm3, t5.0, W190
15	8	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{W}+60	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
16	8	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{H}	EA	6	t	밀도1.2g/cm3, t5.0, W190 + CW W200
17	8	8	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	7	t	CW 120kg/m3, t25, W200 양면
18	8	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	2.00	\N	EA	8	t	C/BAR t1.0 간격50이하
19	9	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
20	9	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
21	10	8	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 120kg/m3 보온재
22	11	11	글라스울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	GW 24kg/m3 보온재
23	12	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
25	13	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}-5	EA	2	t	밀도1.2g/cm3, t5.0, W190
26	13	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{H}-30	EA	3	t	밀도1.2g/cm3, t5.0, W190
27	13	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{W}+60	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
28	13	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
29	13	8	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 120kg/m3, t25, W200
30	13	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	1.00	\N	EA	7	t	C/BAR t1.0 간격50이하
31	14	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
32	14	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
33	15	11	글라스울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	GW 24kg/m3 보온재
35	16	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}-5	EA	2	t	밀도1.2g/cm3, t5.0, W190
36	16	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{H}-30	EA	3	t	밀도1.2g/cm3, t5.0, W190
37	16	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{W}+60	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
38	16	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
39	16	8	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 120kg/m3, t25, W200
40	16	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	1.00	\N	EA	7	t	C/BAR t1.0 간격50이하
41	17	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
42	17	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
43	18	8	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 120kg/m3 보온재
44	19	11	글라스울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	GW 24kg/m3 보온재
45	20	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
47	21	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}-5	EA	2	t	밀도1.2g/cm3, t5.0, W190
48	21	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{H}-30	EA	3	t	밀도1.2g/cm3, t5.0, W190
49	21	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{W}+60	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
50	21	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
51	21	8	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 120kg/m3, t25, W200
52	21	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	1.00	\N	EA	7	t	C/BAR t1.0 간격50이하
53	22	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
54	22	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
55	23	8	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 120kg/m3 보온재
56	24	11	글라스울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	GW 24kg/m3 보온재
57	25	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
59	26	21	차열시트 내부(상/하/중앙)	SHEET_INTERIOR	MANUFACTURE	\N	12.00	{W}/2-35	EA	2	t	밀도1.2g/cm3, t5.0, W190
60	26	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	8.00	{H}/2-20	EA	3	t	밀도1.2g/cm3, t5.0, W190
61	26	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{W}/2+30	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
62	26	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
63	26	10	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 96kg/m3, t25, W200 양면
64	26	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	2.00	\N	EA	7	t	C/BAR t1.0 간격50이하
65	27	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
66	27	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
67	28	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
68	29	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
70	30	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}-5	EA	2	t	밀도1.2g/cm3, t5.0, W190
71	30	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{H}-30	EA	3	t	밀도1.2g/cm3, t5.0, W190
72	30	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{W}+60	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
73	30	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
74	30	10	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 96kg/m3, t25, W200
75	30	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	1.00	\N	EA	7	t	C/BAR t1.0 간격50이하
76	31	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
77	31	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
78	32	21	차열시트(틈새용)	GAP_SHEET	MANUFACTURE	{gap_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0 틈새충전
79	32	10	세라믹차열재(틈새용)	CERAMIC_EXT	PURCHASE	{gap_qty}	\N	\N	EA	2	t	CW 96kg/m3 틈새충전
80	33	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
81	34	11	글라스울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	GW 24kg/m3 보온재
83	35	21	차열시트 내부(받침대)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}/2-15	EA	2	t	밀도1.2g/cm3, t5.0, W190
84	35	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	14.00	{W}/2-15	EA	3	t	밀도1.2g/cm3, t5.0, W190
85	35	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	16.00	{H}/2-20	EA	4	t	밀도1.2g/cm3, t5.0, W190
86	35	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{W}/2+30	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
87	35	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{H}	EA	6	t	밀도1.2g/cm3, t5.0, W190 + CW W200
88	35	10	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	7	t	CW 96kg/m3, t25, W200 양면
89	35	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	2.00	\N	EA	8	t	C/BAR t1.0 간격50이하
90	36	21	차열시트(틈새용)	GAP_SHEET	MANUFACTURE	{gap_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0 틈새충전
91	36	10	세라믹차열재(틈새용)	CERAMIC_EXT	PURCHASE	{gap_qty}	\N	\N	EA	2	t	CW 96kg/m3 틈새충전
92	37	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
93	37	5	고정용 브라켓 GI(I형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000
94	38	59	고정자재	FIXING	PURCHASE	\N	1.00	\N	EA	1	t	보호철판/앵커 등
95	39	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
96	40	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
98	41	21	차열시트 내부(받침대)	SHEET_INTERIOR	MANUFACTURE	\N	4.00	{W}/2-15	EA	2	t	밀도1.2g/cm3, t5.0, W190
99	41	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	14.00	{W}/2-15	EA	3	t	밀도1.2g/cm3, t5.0, W190
100	41	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	16.00	{H}/2-20	EA	4	t	밀도1.2g/cm3, t5.0, W190
101	41	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{W}/2+30	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
102	41	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	4.00	{H}	EA	6	t	밀도1.2g/cm3, t5.0, W190 + CW W200
103	41	10	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	7	t	CW 96kg/m3, t25, W200 양면
104	41	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	2.00	\N	EA	8	t	C/BAR t1.0 간격50이하
105	42	21	차열시트(틈새용)	GAP_SHEET	MANUFACTURE	{gap_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0 틈새충전
106	42	10	세라믹차열재(틈새용)	CERAMIC_EXT	PURCHASE	{gap_qty}	\N	\N	EA	2	t	CW 96kg/m3 틈새충전
107	43	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t4.0, W125, L1000
108	43	7	고정용 브라켓 GI(Z형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000 Z형
109	44	59	고정자재	FIXING	PURCHASE	\N	1.00	\N	EA	1	t	보호철판/앵커 등
110	45	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
111	46	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
113	47	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	6.00	{W}-5	EA	2	t	밀도1.2g/cm3, t5.0, W190
114	47	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	6.00	{H}-30	EA	3	t	밀도1.2g/cm3, t5.0, W190
115	47	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{W}+60	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
116	47	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
117	47	10	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 96kg/m3, t25, W200
118	47	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	1.00	\N	EA	7	t	C/BAR t1.0 간격50이하
119	48	21	차열시트(틈새용)	GAP_SHEET	MANUFACTURE	{gap_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0 틈새충전
120	48	10	세라믹차열재(틈새용)	CERAMIC_EXT	PURCHASE	{gap_qty}	\N	\N	EA	2	t	CW 96kg/m3 틈새충전
121	49	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t4.0, W125, L1000
122	49	7	고정용 브라켓 GI(Z형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000 Z형
123	50	59	고정자재	FIXING	PURCHASE	\N	1.00	\N	EA	1	t	보호철판/앵커 등
124	51	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
125	52	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
127	53	21	차열시트 내부(상/하)	SHEET_INTERIOR	MANUFACTURE	\N	6.00	{W}-5	EA	2	t	밀도1.2g/cm3, t5.0, W190
128	53	21	차열시트 내부(좌/우)	SHEET_INTERIOR	MANUFACTURE	\N	6.00	{H}-30	EA	3	t	밀도1.2g/cm3, t5.0, W190
129	53	21	차열시트 외부(상/하)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{W}+60	EA	4	t	밀도1.2g/cm3, t5.0, W190 + CW W200
130	53	21	차열시트 외부(좌/우)	SHEET_EXTERIOR	MANUFACTURE	\N	2.00	{H}	EA	5	t	밀도1.2g/cm3, t5.0, W190 + CW W200
131	53	10	세라믹차열재 외부	CERAMIC_EXT	PURCHASE	{dimension_based}	\N	\N	EA	6	t	CW 96kg/m3, t25, W200
132	53	5	고정용 브라켓 GI	BRACKET_GI	PURCHASE	\N	1.00	\N	EA	7	t	C/BAR t1.0 간격50이하
133	54	22	차열시트(플래싱용)	SHEET	MANUFACTURE	{flashing_qty}	\N	\N	EA	1	t	밀도1.2g/cm3, t5.0, W125, L1000
134	54	6	고정용 브라켓 GI(L형)	BRACKET	PURCHASE	{flashing_qty}	\N	\N	EA	2	t	아연도금강판 t0.5, W125, L1000 L형
135	55	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
136	56	21	차열시트(틈새용)	GAP_SHEET	MANUFACTURE	\N	2.00	\N	EA	1	t	밀도1.2g/cm3, t5.0 틈새충전 200×1000
137	56	10	세라믹차열재(틈새용)	CERAMIC_EXT	PURCHASE	\N	2.00	\N	EA	2	t	CW 96kg/m3 틈새충전
138	57	22	차열시트(BD플래싱용)	SHEET	MANUFACTURE	\N	2.00	\N	EA	1	t	BD플래싱 SUS304용 차열시트
139	57	49	고정용 브라켓 SUS304	BRACKET	PURCHASE	\N	2.00	\N	EA	2	t	SUS304 브라켓
140	58	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
141	59	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
142	60	21	차열시트(틈새용)	GAP_SHEET	MANUFACTURE	\N	4.00	\N	EA	1	t	밀도1.2g/cm3, t5.0 틈새충전 200×1000
143	60	10	세라믹차열재(틈새용)	CERAMIC_EXT	PURCHASE	\N	4.00	\N	EA	2	t	CW 96kg/m3 틈새충전
144	61	22	차열시트(BD플래싱 대형)	SHEET	MANUFACTURE	\N	2.00	\N	EA	1	t	BD플래싱 아연도금 대형용 차열시트
145	61	5	고정용 브라켓 GI(대형)	BRACKET	PURCHASE	\N	2.00	\N	EA	2	t	아연도금강판 브라켓 대형
146	62	22	차열시트(BD플래싱 소형)	SHEET	MANUFACTURE	\N	2.00	\N	EA	1	t	BD플래싱 아연도금 소형용 차열시트
147	62	5	고정용 브라켓 GI(소형)	BRACKET	PURCHASE	\N	2.00	\N	EA	2	t	아연도금강판 브라켓 소형
148	63	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
149	64	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
150	65	58	발포소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	FN Tech 발포소켓 100A
151	66	10	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 96kg/m3 보온재
152	5	8	세라믹울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	CW 120kg/m3 보온재
153	6	11	글라스울 보온재	INSULATION	PURCHASE	\N	1.00	\N	EA	1	t	GW 24kg/m3 보온재
154	7	57	실리콘 실란트	SEALANT	PURCHASE	\N	1.00	\N	EA	1	t	내화용 실란트
1	3	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판
11	8	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓
24	13	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓
34	16	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓
46	21	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓
58	26	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓
69	30	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓
82	35	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓 H300
97	41	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓 H300
112	47	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓 H300
126	53	3468	금속소켓 본체	SOCKET_BODY	PURCHASE	\N	1.00	\N	EA	1	t	t1.6 아연도금강판 가공 소켓 H300
\.


--
-- Data for Name: purchase_request; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_request (pr_id, pr_number, order_id, pr_date, supplier_name, status, remarks, created_by, created_at, total_amount) FROM stdin;
1	PR-260331-001	1	2026-03-31	\N	ORDERED	\N	\N	2026-03-31 12:09:07.895652+00	0.00
\.


--
-- Data for Name: purchase_request_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_request_item (pri_id, pr_id, item_id, item_code, item_name, required_qty, order_qty, unit, unit_price, delivery_date, remarks, sort_order, spec_detail, calc_note, component_name, roll_count, roll_spec, amount, item_subcategory, item_spec, receiving_status, received_qty, received_at, lot_id, insp_id) FROM stdin;
2	1	2	RM-EG50	팽창흑연 #50	30.30	30.30	kg	\N	\N	\N	1	인정배합 → 팽창흑연 #50	148.54kg ÷ 300/배치 = 0.50배치 × 60.0000kg × 로스2% = 30.3	팽창흑연 #50(역전개)	\N	\N	\N	배합원료	배합원료	PENDING	0.00	\N	\N	\N
3	1	4	RM-EP	EVA-EP100	22.73	22.73	kg	\N	\N	\N	2	인정배합 → EVA-EP100	148.54kg ÷ 300/배치 = 0.50배치 × 45.0000kg × 로스2% = 22.73	EVA-EP100(역전개)	\N	\N	\N	배합원료	배합원료	PENDING	0.00	\N	\N	\N
4	1	1	RM-MB	난연컴파운드(PE3005MB)	75.76	75.76	kg	\N	\N	\N	3	인정배합 → 난연컴파운드 PE3005MB	148.54kg ÷ 300/배치 = 0.50배치 × 150.0000kg × 로스2% = 75.76	난연컴파운드 PE3005MB(역전개)	\N	\N	\N	배합원료	배합원료	PENDING	0.00	\N	\N	\N
5	1	2429	SM-BRK-MD	소켓 브라켓(중앙)	4.00	4.00	EA	\N	\N	\N	4	SGCC, H10×W190×L1265, t0.6이상	소켓 2개 × 중앙2EA/소켓 = 4EA × 1세트 = 4	소켓 브라켓(중앙)(HTG-1.69)	\N	\N	\N	브라켓	SGCC, H10×W190×L1265, t0.6이상	PENDING	0.00	\N	\N	\N
6	1	2428	SM-BRK-TB	소켓 브라켓(상/하)	40.00	40.00	EA	\N	\N	\N	5	SGCC, H15×W190×L1265, t0.6이상 | SGCC, H15×W190×L1265, t0.6이상	소켓 1개 × 상하4EA/소켓 = 4EA × 8세트 = 32\n소켓 2개 × 상하4EA/소켓 = 8EA × 1세트 = 8	소켓 브라켓(상/하)(VA-064), 소켓 브라켓(상/하)(HTG-1.69)	\N	\N	\N	브라켓	SGCC, H15×W190×L1265, t0.6이상	PENDING	0.00	\N	\N	\N
7	1	3912	SM-CW-128-25	세라믹차열재 128K t25 W200	21.76	21.76	M	\N	\N	\N	6	밀도128kg/m³(기준≥120), 두께25mm, W200, L660 | 밀도128kg/m³(기준≥120), 두께25mm, W200, L700	상하2EA × 660mm ÷ 1000 = 1.32M × 8세트 = 10.56\n좌우2EA × 700mm ÷ 1000 = 1.4M × 8세트 = 11.2	세라믹블랭킷(상하)(VA-064), 세라믹블랭킷(좌우)(VA-064)	\N	\N	\N	세라믹차열재	밀도128kg/m³, t25, W200 (블랭킷)	PENDING	0.00	\N	\N	\N
8	1	3909	SM-CW-96-25W3	세라믹차열재 96K t25 W300	4.52	4.52	M	\N	\N	\N	7	밀도96kg/m³(기준≥96), 두께25mm, W300, L1260 | 밀도96kg/m³(기준≥96), 두께25mm, W300, L1000	상하2EA × 1260mm ÷ 1000 = 2.52M × 1세트 = 2.52\n좌우2EA × 1000mm ÷ 1000 = 2M × 1세트 = 2	세라믹블랭킷(상하)(HTG-1.69), 세라믹블랭킷(좌우)(HTG-1.69)	\N	\N	\N	세라믹차열재	밀도96kg/m³, t25, W300 (블랭킷 바닥)	PENDING	0.00	\N	\N	\N
9	1	3911	SM-CW-96-38	세라믹차열재 96K t38 W600	24.00	24.00	M	\N	\N	\N	8	밀도96kg/m³, 두께38mm, W600 | 밀도96kg/m³, 두께38mm, W600 | 밀도96kg/m³, 두께38mm, W600	1200mm×4면÷1000÷0.6=8M (2단) × 1세트 = 8\n1200mm×4면÷1000÷0.6=8M (3단) × 1세트 = 8\n1200mm×4면÷1000÷0.6=8M (4단) × 1세트 = 8	지지구조 세라믹차열재2단(96K)(HTG-1.69), 지지구조 세라믹차열재3단(96K)(HTG-1.69), 지지구조 세라믹차열재4단(96K)(HTG-1.69)	\N	\N	\N	세라믹차열재	밀도96kg/m³, t38, W600 (지지구조 1.69)	PENDING	0.00	\N	\N	\N
10	1	3910	SM-CW-96-50	세라믹차열재 96K t50 W600	32.00	32.00	M	\N	\N	\N	9	밀도96kg/m³, 두께50mm, W600, 양면대칭	배관길이600mm × 4면 ÷ 1000 ÷ 0.6(롤폭) = 4M × 8세트 = 32	지지구조 세라믹차열재1단(96K)(VA-064)	\N	\N	\N	세라믹차열재	밀도96kg/m³, t50, W600 (지지구조)	PENDING	0.00	\N	\N	\N
11	1	5550	SM-GI-I-10	강재류 아연도금강판(I형) L1000	56.00	56.00	EA	\N	\N	\N	10	아연도금강판 SGCC(KS D 3506), t0.5, W125, L1000	플래싱 7세트 × 강판1장/세트 = 7장 × 8세트 = 56	플래싱용 아연도금강판(I형)(VA-064)	\N	\N	\N	강재류	SGCC t0.5, W125×L1000	PENDING	0.00	\N	\N	\N
12	1	5551	SM-GI-Z-10	강재류 아연도금강판(Z형) L1000	11.00	11.00	EA	\N	\N	\N	11	아연도금강판 SGCC(KS D 3506), t0.5, W170, L1000	플래싱 11세트 × 강판1장/세트 = 11장 × 1세트 = 11	플래싱용 아연도금강판(Z형)(HTG-1.69)	\N	\N	\N	강재류	SGCC t0.5, W215×L1000	PENDING	0.00	\N	\N	\N
13	1	5553	SM-GP-10	고정자재 L1000	10.00	10.00	EA	\N	\N	\N	12	아연도금강판 SGCC, L1000×H200×t0.5	틈새복합시트 10EA × 1:1 = 10EA × 1세트 = 10	고정자재(틈새시트 이탈방지)(HTG-1.69)	\N	\N	\N	고정자재	아연도금강판 SGCC t0.5, L1000	PENDING	0.00	\N	\N	\N
14	1	3913	SM-GW-24-14	글라스울 24K W1400	89.12	89.12	M	\N	\N	\N	13	밀도24kg/m³, 두께25mm, W1400(롤폭) | 밀도24kg/m³, 두께25mm, W1400, 양면대칭 | 밀도24kg/m³, 두께25mm, W1400(롤폭) | 밀도24kg/m³, 두께25mm, W1400	(600+700)×2×4면÷1000÷1.4=7.43M × 8세트 = 59.44\n600mm×4면÷1000÷1.4=1.71M × 8세트 = 13.68\n(1200+1000)×2×4면÷1000÷1.4=12.57M × 1세트 = 12.57\n1200mm×4면÷1000÷1.4=3.43M × 1세트 = 3.43	글라스울 덕트보온재(24K)(VA-064), 지지구조 그라스울2단(24K)(VA-064), 글라스울 덕트보온재(24K)(HTG-1.69), 지지구조 그라스울1단(24K)(HTG-1.69)	\N	\N	\N	글라스울	밀도24kg/m³, t25, W1400	PENDING	0.00	\N	\N	\N
15	1	57	SM-SIL	실란트	8.00	8.00	EA	\N	\N	\N	14	KS F 4910 F-12.5E, t3이상, 오버랩3이상	둘레2600mm ÷ 3000mm/EA × 1소켓 = 1EA × 8세트 = 8	실리콘 실란트(VA-064)	\N	\N	\N	밀봉재	실리콘실란트	PENDING	0.00	\N	\N	\N
16	1	3468	SM-SK-BODY	금속소켓 본체(아연도금강판)	12.00	12.00	EA	\N	\N	\N	15	SGCC t1.6, W1700×H500×높이200mm (VA-064 VM200) | SGCC t1.6, W1320×H750×높이300mm (HAG-1.69 HTG300C) ×2개조립 | SGCC t1.6, W1350×H810×높이300mm (HTG-1.69 HTG300C) ×2개조립	방화소켓(VA-064) 8EA × 금속소켓 본체 1EA/소켓 = 8\n방화소켓(HTG-1.69) 2EA × 금속소켓 본체 1EA/소켓 = 2\n방화소켓(HTG-1.69) 2EA × 금속소켓 본체 1EA/소켓 = 2	금속소켓 본체(product_bom 전개), 금속소켓 본체(product_bom 전개), 금속소켓 본체(product_bom 전개)	\N	\N	\N	강재류	아연도금강판 SGCC t1.6, 소켓본체	PENDING	0.00	\N	\N	\N
1	1	3	RM-EA	EVA-EA33045	22.73	22.73	kg	\N	\N	\N	0	인정배합 → EVA-EA33045	148.54kg ÷ 300/배치 = 0.50배치 × 45.0000kg × 로스2% = 22.73	EVA-EA33045(역전개)	\N	\N	\N	배합원료	배합원료	RECEIVED	22.73	2026-03-31 14:07:07.415815+00	1	1
\.


--
-- Data for Name: sales_order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_order (order_id, order_number, order_date, customer_name, project_name, delivery_date, status, total_sets, remarks, created_at) FROM stdin;
1	SO-260303-001	2026-03-03	㈜하나로엔지니어링	인천검단101역세권C1현장	\N	IN_PRODUCTION	9	엑셀업로드: 주문서	2026-03-31 03:10:26.275538+00
\.


--
-- Data for Name: sales_order_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales_order_item (order_item_id, order_id, cert_id, structure_code, qty, opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, spec_note, sort_order) FROM stdin;
1	1	4	VA-064	8	700	800	600	700	금속 | 그라스울 | 2동2층 | [주문서]	0
2	1	9	HTG-1.69	1	1300	1100	1200	1000	금속 | 그라스울 | 2동2층 | [주문서]	1
\.


--
-- Data for Name: self_inspection; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.self_inspection (self_insp_id, wo_id, check_time, check_category, check_point, standard_value, tolerance, measured_value, is_ok, worker, remarks) FROM stdin;
\.


--
-- Data for Name: structure_bom; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.structure_bom (sbom_id, cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order, is_active, remarks) FROM stdin;
3	1	SOCKET	방화소켓 VT200	SOCKET	MANUFACTURE	23	{N}	\N	t	1	t	\N
4	1	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
5	1	SUPPORT_CW	지지구조단열재(1단) 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
6	1	SUPPORT_GW	지지구조단열재(2단) 글라스울24K	SUPPORT	PURCHASE	11	\N	2.00	f	4	t	\N
7	1	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	5	t	\N
8	2	SOCKET	방화소켓 VS200+VG200	SOCKET	MANUFACTURE	24	{N}	\N	t	1	t	\N
9	2	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
10	2	SUPPORT_CW	지지구조단열재(1단) 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
11	2	SUPPORT_GW	지지구조단열재(2단) 글라스울24K	SUPPORT	PURCHASE	11	\N	2.00	f	4	t	\N
12	2	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	5	t	\N
13	3	SOCKET	방화소켓 VM200	SOCKET	MANUFACTURE	25	1	\N	t	1	t	\N
14	3	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
15	3	SUPPORT_GW	지지구조단열재 글라스울24K	SUPPORT	PURCHASE	11	\N	2.00	f	3	t	\N
16	4	SOCKET	방화소켓 VM200	SOCKET	MANUFACTURE	27	1	\N	t	1	t	\N
17	4	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
18	4	SUPPORT_CW	지지구조단열재(1단) 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
19	4	SUPPORT_GW	지지구조단열재(2단) 글라스울24K	SUPPORT	PURCHASE	11	\N	2.00	f	4	t	\N
20	4	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	5	t	\N
21	5	SOCKET	방화소켓 VM200	SOCKET	MANUFACTURE	26	1	\N	t	1	t	\N
22	5	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
23	5	SUPPORT_CW	지지구조단열재(1단) 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
24	5	SUPPORT_GW	지지구조단열재(2단) 글라스울24K	SUPPORT	PURCHASE	11	\N	2.00	f	4	t	\N
25	5	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	5	t	\N
26	6	SOCKET	방화소켓 VTG200	SOCKET	MANUFACTURE	28	{N}	\N	t	1	t	\N
27	6	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
28	6	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
29	6	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	4	t	\N
30	7	SOCKET	방화소켓 VIG200	SOCKET	MANUFACTURE	29	1	\N	t	1	t	\N
31	7	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
32	7	GAP_COMPOSITE	틈새복합시트	GAP_SHEET	MANUFACTURE	39	\N	\N	t	3	t	\N
33	7	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	4	t	\N
34	7	SUPPORT_GW	지지구조단열재 글라스울24K	SUPPORT	PURCHASE	11	\N	2.00	f	5	t	\N
35	8	SOCKET	방화소켓 HTG300C	SOCKET	MANUFACTURE	30	{N}	\N	t	1	t	\N
36	8	GAP_COMPOSITE	틈새복합시트	GAP_SHEET	MANUFACTURE	39	\N	\N	t	2	t	\N
37	8	FLASHING_I	방화플래싱 I형	FLASHING	MANUFACTURE	33	CEIL({perimeter}/1000)*2	\N	t	3	t	\N
38	8	FIXING	고정자재 GI	FIXING	PURCHASE	59	\N	\N	t	4	t	\N
39	8	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	5	t	\N
40	8	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	6	t	\N
41	9	SOCKET	방화소켓 HTG300C	SOCKET	MANUFACTURE	30	{N}	\N	t	1	t	\N
42	9	GAP_COMPOSITE	틈새복합시트	GAP_SHEET	MANUFACTURE	39	\N	\N	t	2	t	\N
43	9	FLASHING_Z	방화플래싱 Z형	FLASHING	MANUFACTURE	34	CEIL({perimeter}/1000)*2	\N	t	3	t	\N
44	9	FIXING	고정자재 GI	FIXING	PURCHASE	59	\N	\N	t	4	t	\N
45	9	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	5	t	\N
46	9	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	6	t	\N
47	10	SOCKET	방화소켓 HMG300C	SOCKET	MANUFACTURE	31	1	\N	t	1	t	\N
48	10	GAP_COMPOSITE	틈새복합시트	GAP_SHEET	MANUFACTURE	39	\N	\N	t	2	t	\N
49	10	FLASHING_Z	방화플래싱 Z형	FLASHING	MANUFACTURE	34	CEIL({perimeter}/1000)*2	\N	t	3	t	\N
50	10	FIXING	고정자재 GI	FIXING	PURCHASE	59	\N	\N	t	4	t	\N
51	10	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	5	t	\N
52	10	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	6	t	\N
53	11	SOCKET	방화소켓 HMG300	SOCKET	MANUFACTURE	32	1	\N	t	1	t	\N
54	11	FLASHING_L	방화플래싱 L형	FLASHING	MANUFACTURE	35	CEIL({perimeter}/1000)*2	\N	t	2	t	\N
55	11	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
56	12	GAP_COMPOSITE	틈새복합시트	GAP_SHEET	MANUFACTURE	39	\N	8.00	f	1	t	\N
57	12	FLASHING_SUS	방화플래싱 SUS304	FLASHING	MANUFACTURE	36	\N	4.00	f	2	t	\N
58	12	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	3	t	\N
59	12	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	4	t	\N
60	13	GAP_COMPOSITE	틈새복합시트	GAP_SHEET	MANUFACTURE	39	\N	12.00	f	1	t	\N
61	13	FLASHING_GI_L	방화플래싱 아연도금 대형	FLASHING	MANUFACTURE	37	\N	4.00	f	2	t	\N
62	13	FLASHING_GI_S	방화플래싱 아연도금 소형	FLASHING	MANUFACTURE	38	\N	4.00	f	3	t	\N
63	13	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	4	t	\N
64	13	SEALANT	실란트	SEALANT	PURCHASE	13	\N	1.00	f	5	t	\N
65	14	FN_SOCKET	내화충전발포소켓 100A	SOCKET	PURCHASE	40	\N	1.00	f	1	t	\N
66	14	SUPPORT_CW	지지구조단열재 세라믹울96K	SUPPORT	PURCHASE	10	\N	2.00	f	2	t	\N
\.


--
-- Data for Name: tbm_attendee; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tbm_attendee (attendee_id, tbm_id, worker_name, department, is_present, sign_time, remarks) FROM stdin;
\.


--
-- Data for Name: tbm_issue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tbm_issue (issue_id, tbm_id, title, description, priority, status, assigned_to, created_at, resolved_at, resolution, due_date) FROM stdin;
\.


--
-- Data for Name: tbm_meeting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tbm_meeting (tbm_id, meeting_date, session, conductor, safety_topics, work_topics, issue_topics, weather, temperature, remarks, status, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: work_order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_order (wo_id, wo_number, wo_date, process_code, product_type, cut_subtype, install_type, cert_id, order_id, item_id, planned_qty, actual_qty, status, equipment_id, manager_id, am_worker, pm_worker, night_worker, inspector, start_time, end_time, downtime_minutes, downtime_reason, production_length_m, input_weight_kg, scrap_kg, serial_number, purpose, spec_detail, customer_name, lot_number, input_lot_numbers, bom_version, remarks, completed_at, created_at, mix_time_minutes, actual_weight_kg, incoming_inspection_status, raw_material_lots, thickness_mm, width_mm, density_gcm3, expansion_mm, ext_spec, project_site, structure_name, dimension_width, dimension_height, inner_width, inner_height, socket_lot, sheet_lot, ceramic_lot, sealant_lot, asm_structure, asm_width, asm_height) FROM stdin;
1	WO-MIX-20260407-001	2026-04-07	MIX	MIX	\N	\N	\N	1	\N	151.52	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	EVA-EA33045, 팽창흑연 #50, EVA-EP100, 난연컴파운드(PE3005MB)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.004581+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	WO-EXT-20260407-001	2026-04-07	EXT	EXT	\N	\N	\N	1	20	77.05	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	압출 플래싱차열시트 4T×125(Z형)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.007837+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	재단(플래싱용) → 압출 플래싱차열시트 4T×125(Z형)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3	WO-EXT-20260407-002	2026-04-07	EXT	EXT	\N	\N	\N	1	19	77.05	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	압출 플래싱차열시트 5T×125(I형)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.009626+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	재단(플래싱용) → 압출 플래싱차열시트 5T×125(I형)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	WO-EXT-20260407-003	2026-04-07	EXT	EXT	\N	\N	\N	1	17	126.50	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	압출(5T-190) 소켓용	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.010881+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	재단(소켓용) → 압출 차열시트 5T×190(소켓용)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5	WO-CUT-20260407-001	2026-04-07	CUT	CUT	\N	\N	\N	1	22	67.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	재단(플래싱용)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.011969+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	밀도1.2g/cm³, t5mm, W125, L1000 | 밀도1.2g/cm³, t5mm, 	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	WO-CUT-20260407-002	2026-04-07	CUT	CUT	\N	\N	\N	1	21	110.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	재단(소켓용)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.012809+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	밀도1.2g/cm³, 두께5mm, 190×595 | 밀도1.2g/cm³, 두께5mm, 19	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7	WO-ASM-20260407-001	2026-04-07	ASM	ASM	\N	\N	\N	1	33	56.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	플래싱(I형)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.013614+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	방화플래싱(I형)(VA-064)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8	WO-ASM-20260407-002	2026-04-07	ASM	ASM	\N	\N	\N	1	34	11.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	플래싱(Z형)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.014714+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	방화플래싱(Z형)(HTG-1.69)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9	WO-ASM-20260407-003	2026-04-07	ASM	ASM	\N	\N	\N	1	83	10.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	틈새복합시트	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.01561+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	틈새복합시트(200H)(HTG-1.69)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10	WO-ASM-20260407-004	2026-04-07	ASM	ASM	\N	\N	\N	1	30	2.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	방화소켓(HTG-1.69)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.01685+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	금속소켓 본체(HTG-1.69)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
11	WO-ASM-20260407-005	2026-04-07	ASM	ASM	\N	\N	\N	1	27	8.00	\N	PLANNED	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	방화소켓(VA-064)	㈜하나로엔지니어링	\N	\N	\N	BOM자동생성 - SO-260303-001	\N	2026-03-31 14:03:11.017552+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	금속소켓 본체(VA-064)	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: worker; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.worker (worker_id, worker_name, birth_date, pin_code, department, "position", role, is_active, created_at) FROM stdin;
1	김철수	\N	1234	생산팀	반장	worker	t	2026-03-30 02:04:06.501031+00
2	이영희	\N	5678	생산팀	조장	worker	t	2026-03-30 02:04:06.501031+00
3	박민수	\N	9012	품질팀	검사원	worker	t	2026-03-30 02:04:06.501031+00
4	정수현	\N	3456	생산팀	작업자	worker	t	2026-03-30 02:04:06.501031+00
5	최동원	\N	7890	생산팀	작업자	worker	t	2026-03-30 02:04:06.501031+00
6	관리자	1990-01-01	0300	관리부	파트장	admin	t	2026-03-30 02:04:12.274115+00
\.


--
-- Name: approval_approval_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.approval_approval_id_seq', 5, true);


--
-- Name: approval_line_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.approval_line_line_id_seq', 2, true);


--
-- Name: attachment_att_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attachment_att_id_seq', 1, false);


--
-- Name: bom_master_bom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bom_master_bom_id_seq', 54, true);


--
-- Name: cert_document_cert_doc_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cert_document_cert_doc_id_seq', 7, true);


--
-- Name: certification_master_cert_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.certification_master_cert_id_seq', 202, true);


--
-- Name: certification_rule_rule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.certification_rule_rule_id_seq', 43, true);


--
-- Name: closing_adjustment_adj_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.closing_adjustment_adj_id_seq', 1, false);


--
-- Name: closing_item_ci_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.closing_item_ci_id_seq', 1, false);


--
-- Name: compounding_recipe_item_recipe_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.compounding_recipe_item_recipe_item_id_seq', 4, true);


--
-- Name: compounding_recipe_recipe_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.compounding_recipe_recipe_id_seq', 1, true);


--
-- Name: defect_record_defect_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.defect_record_defect_id_seq', 1, false);


--
-- Name: disposal_report_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.disposal_report_report_id_seq', 1, false);


--
-- Name: inspection_detail_detail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_detail_detail_id_seq', 4, true);


--
-- Name: inspection_insp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inspection_insp_id_seq', 1, true);


--
-- Name: inventory_closing_closing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_closing_closing_id_seq', 1, false);


--
-- Name: inventory_transaction_inv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_transaction_inv_id_seq', 1, false);


--
-- Name: item_master_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_master_item_id_seq', 7868, true);


--
-- Name: loss_record_loss_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.loss_record_loss_id_seq', 1, false);


--
-- Name: lot_genealogy_genealogy_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lot_genealogy_genealogy_id_seq', 1, false);


--
-- Name: lot_properties_prop_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lot_properties_prop_id_seq', 1, false);


--
-- Name: lot_transaction_lot_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lot_transaction_lot_id_seq', 1, true);


--
-- Name: order_bom_result_result_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_bom_result_result_id_seq', 27, true);


--
-- Name: process_bom_bom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.process_bom_bom_id_seq', 1434, true);


--
-- Name: process_bom_item_bom_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.process_bom_item_bom_item_id_seq', 146, true);


--
-- Name: process_event_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.process_event_event_id_seq', 1, true);


--
-- Name: process_issue_issue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.process_issue_issue_id_seq', 1, false);


--
-- Name: process_log_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.process_log_log_id_seq', 6, true);


--
-- Name: product_bom_pbom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_bom_pbom_id_seq', 154, true);


--
-- Name: purchase_request_item_pri_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_request_item_pri_id_seq', 16, true);


--
-- Name: purchase_request_pr_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_request_pr_id_seq', 1, true);


--
-- Name: sales_order_item_order_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_order_item_order_item_id_seq', 2, true);


--
-- Name: sales_order_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sales_order_order_id_seq', 1, true);


--
-- Name: self_inspection_self_insp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.self_inspection_self_insp_id_seq', 1, false);


--
-- Name: structure_bom_sbom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.structure_bom_sbom_id_seq', 66, true);


--
-- Name: tbm_attendee_attendee_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tbm_attendee_attendee_id_seq', 1, false);


--
-- Name: tbm_issue_issue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tbm_issue_issue_id_seq', 1, false);


--
-- Name: tbm_meeting_tbm_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tbm_meeting_tbm_id_seq', 1, false);


--
-- Name: work_order_wo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.work_order_wo_id_seq', 11, true);


--
-- Name: worker_worker_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.worker_worker_id_seq', 6, true);


--
-- Name: approval_line approval_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_line
    ADD CONSTRAINT approval_line_pkey PRIMARY KEY (line_id);


--
-- Name: approval approval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_pkey PRIMARY KEY (approval_id);


--
-- Name: attachment attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_pkey PRIMARY KEY (att_id);


--
-- Name: bom_master bom_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_master
    ADD CONSTRAINT bom_master_pkey PRIMARY KEY (bom_id);


--
-- Name: cert_document cert_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_document
    ADD CONSTRAINT cert_document_pkey PRIMARY KEY (cert_doc_id);


--
-- Name: certification_master certification_master_cert_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_master
    ADD CONSTRAINT certification_master_cert_number_key UNIQUE (cert_number);


--
-- Name: certification_master certification_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_master
    ADD CONSTRAINT certification_master_pkey PRIMARY KEY (cert_id);


--
-- Name: certification_rule certification_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_rule
    ADD CONSTRAINT certification_rule_pkey PRIMARY KEY (rule_id);


--
-- Name: closing_adjustment closing_adjustment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_adjustment
    ADD CONSTRAINT closing_adjustment_pkey PRIMARY KEY (adj_id);


--
-- Name: closing_item closing_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_item
    ADD CONSTRAINT closing_item_pkey PRIMARY KEY (ci_id);


--
-- Name: compounding_recipe_item compounding_recipe_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe_item
    ADD CONSTRAINT compounding_recipe_item_pkey PRIMARY KEY (recipe_item_id);


--
-- Name: compounding_recipe compounding_recipe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe
    ADD CONSTRAINT compounding_recipe_pkey PRIMARY KEY (recipe_id);


--
-- Name: compounding_recipe compounding_recipe_recipe_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe
    ADD CONSTRAINT compounding_recipe_recipe_code_key UNIQUE (recipe_code);


--
-- Name: defect_record defect_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_record
    ADD CONSTRAINT defect_record_pkey PRIMARY KEY (defect_id);


--
-- Name: disposal_report disposal_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_report
    ADD CONSTRAINT disposal_report_pkey PRIMARY KEY (report_id);


--
-- Name: disposal_report disposal_report_report_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_report
    ADD CONSTRAINT disposal_report_report_number_key UNIQUE (report_number);


--
-- Name: inspection_detail inspection_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_detail
    ADD CONSTRAINT inspection_detail_pkey PRIMARY KEY (detail_id);


--
-- Name: inspection inspection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT inspection_pkey PRIMARY KEY (insp_id);


--
-- Name: inventory_closing inventory_closing_closing_year_closing_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_closing
    ADD CONSTRAINT inventory_closing_closing_year_closing_month_key UNIQUE (closing_year, closing_month);


--
-- Name: inventory_closing inventory_closing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_closing
    ADD CONSTRAINT inventory_closing_pkey PRIMARY KEY (closing_id);


--
-- Name: inventory_transaction inventory_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_pkey PRIMARY KEY (inv_id);


--
-- Name: item_master item_master_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_master
    ADD CONSTRAINT item_master_item_code_key UNIQUE (item_code);


--
-- Name: item_master item_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_master
    ADD CONSTRAINT item_master_pkey PRIMARY KEY (item_id);


--
-- Name: loss_record loss_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_record
    ADD CONSTRAINT loss_record_pkey PRIMARY KEY (loss_id);


--
-- Name: lot_genealogy lot_genealogy_parent_lot_id_child_lot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_genealogy
    ADD CONSTRAINT lot_genealogy_parent_lot_id_child_lot_id_key UNIQUE (parent_lot_id, child_lot_id);


--
-- Name: lot_genealogy lot_genealogy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_genealogy
    ADD CONSTRAINT lot_genealogy_pkey PRIMARY KEY (genealogy_id);


--
-- Name: lot_properties lot_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_properties
    ADD CONSTRAINT lot_properties_pkey PRIMARY KEY (prop_id);


--
-- Name: lot_transaction lot_transaction_lot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_transaction
    ADD CONSTRAINT lot_transaction_lot_number_key UNIQUE (lot_number);


--
-- Name: lot_transaction lot_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_transaction
    ADD CONSTRAINT lot_transaction_pkey PRIMARY KEY (lot_id);


--
-- Name: order_bom_result order_bom_result_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_bom_result
    ADD CONSTRAINT order_bom_result_pkey PRIMARY KEY (result_id);


--
-- Name: process_bom process_bom_bom_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom
    ADD CONSTRAINT process_bom_bom_code_key UNIQUE (bom_code);


--
-- Name: process_bom_item process_bom_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom_item
    ADD CONSTRAINT process_bom_item_pkey PRIMARY KEY (bom_item_id);


--
-- Name: process_bom process_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom
    ADD CONSTRAINT process_bom_pkey PRIMARY KEY (bom_id);


--
-- Name: process_event process_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_event
    ADD CONSTRAINT process_event_pkey PRIMARY KEY (event_id);


--
-- Name: process_issue process_issue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_issue
    ADD CONSTRAINT process_issue_pkey PRIMARY KEY (issue_id);


--
-- Name: process_log process_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_log
    ADD CONSTRAINT process_log_pkey PRIMARY KEY (log_id);


--
-- Name: product_bom product_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bom
    ADD CONSTRAINT product_bom_pkey PRIMARY KEY (pbom_id);


--
-- Name: purchase_request_item purchase_request_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_item
    ADD CONSTRAINT purchase_request_item_pkey PRIMARY KEY (pri_id);


--
-- Name: purchase_request purchase_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request
    ADD CONSTRAINT purchase_request_pkey PRIMARY KEY (pr_id);


--
-- Name: purchase_request purchase_request_pr_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request
    ADD CONSTRAINT purchase_request_pr_number_key UNIQUE (pr_number);


--
-- Name: sales_order_item sales_order_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_item
    ADD CONSTRAINT sales_order_item_pkey PRIMARY KEY (order_item_id);


--
-- Name: sales_order sales_order_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_order_number_key UNIQUE (order_number);


--
-- Name: sales_order sales_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order
    ADD CONSTRAINT sales_order_pkey PRIMARY KEY (order_id);


--
-- Name: self_inspection self_inspection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_inspection
    ADD CONSTRAINT self_inspection_pkey PRIMARY KEY (self_insp_id);


--
-- Name: structure_bom structure_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_bom
    ADD CONSTRAINT structure_bom_pkey PRIMARY KEY (sbom_id);


--
-- Name: tbm_attendee tbm_attendee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_attendee
    ADD CONSTRAINT tbm_attendee_pkey PRIMARY KEY (attendee_id);


--
-- Name: tbm_issue tbm_issue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_issue
    ADD CONSTRAINT tbm_issue_pkey PRIMARY KEY (issue_id);


--
-- Name: tbm_meeting tbm_meeting_meeting_date_session_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_meeting
    ADD CONSTRAINT tbm_meeting_meeting_date_session_key UNIQUE (meeting_date, session);


--
-- Name: tbm_meeting tbm_meeting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_meeting
    ADD CONSTRAINT tbm_meeting_pkey PRIMARY KEY (tbm_id);


--
-- Name: work_order work_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order
    ADD CONSTRAINT work_order_pkey PRIMARY KEY (wo_id);


--
-- Name: work_order work_order_wo_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order
    ADD CONSTRAINT work_order_wo_number_key UNIQUE (wo_number);


--
-- Name: worker worker_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker
    ADD CONSTRAINT worker_pkey PRIMARY KEY (worker_id);


--
-- Name: idx_approval_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_approver ON public.approval USING btree (approver_id, status);


--
-- Name: idx_approval_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_doc ON public.approval USING btree (doc_type, doc_id);


--
-- Name: idx_approval_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_reviewer ON public.approval USING btree (reviewer_id, status);


--
-- Name: idx_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_status ON public.approval USING btree (status);


--
-- Name: idx_approval_writer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_writer ON public.approval USING btree (writer_id);


--
-- Name: idx_bom_cert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_cert_id ON public.bom_master USING btree (cert_id);


--
-- Name: idx_bom_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_item_id ON public.bom_master USING btree (item_id);


--
-- Name: idx_cert_doc_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_doc_expiry ON public.cert_document USING btree (expiry_date);


--
-- Name: idx_cert_doc_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_doc_item ON public.cert_document USING btree (item_id);


--
-- Name: idx_cert_doc_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_doc_supplier ON public.cert_document USING btree (supplier_name, supplier_lot);


--
-- Name: idx_cert_product_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_product_group ON public.certification_master USING btree (product_group);


--
-- Name: idx_cert_structure_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_structure_code ON public.certification_master USING btree (structure_code);


--
-- Name: idx_cert_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_version ON public.certification_master USING btree (cert_version);


--
-- Name: idx_closing_adj_closing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closing_adj_closing ON public.closing_adjustment USING btree (closing_id);


--
-- Name: idx_closing_adj_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closing_adj_status ON public.closing_adjustment USING btree (status);


--
-- Name: idx_closing_item_closing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closing_item_closing ON public.closing_item USING btree (closing_id);


--
-- Name: idx_closing_item_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closing_item_item ON public.closing_item USING btree (item_id);


--
-- Name: idx_detail_insp_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_detail_insp_id ON public.inspection_detail USING btree (insp_id);


--
-- Name: idx_genealogy_child; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genealogy_child ON public.lot_genealogy USING btree (child_lot_id);


--
-- Name: idx_genealogy_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_genealogy_parent ON public.lot_genealogy USING btree (parent_lot_id);


--
-- Name: idx_insp_lot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insp_lot_id ON public.inspection USING btree (lot_id);


--
-- Name: idx_insp_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insp_type ON public.inspection USING btree (insp_type);


--
-- Name: idx_insp_wo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insp_wo_id ON public.inspection USING btree (wo_id);


--
-- Name: idx_inv_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_item_id ON public.inventory_transaction USING btree (item_id);


--
-- Name: idx_inv_txn_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_txn_date ON public.inventory_transaction USING btree (txn_date);


--
-- Name: idx_inv_txn_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_txn_type ON public.inventory_transaction USING btree (txn_type);


--
-- Name: idx_item_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_category ON public.item_master USING btree (item_category);


--
-- Name: idx_lot_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lot_item_id ON public.lot_transaction USING btree (item_id);


--
-- Name: idx_lot_props_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lot_props_lot ON public.lot_properties USING btree (lot_number);


--
-- Name: idx_lot_props_process; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lot_props_process ON public.lot_properties USING btree (process_code);


--
-- Name: idx_lot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lot_status ON public.lot_transaction USING btree (status);


--
-- Name: idx_lot_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lot_type ON public.lot_transaction USING btree (lot_type);


--
-- Name: idx_process_event_log; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_event_log ON public.process_event USING btree (log_id);


--
-- Name: idx_process_log_wo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_log_wo ON public.process_log USING btree (wo_id);


--
-- Name: idx_process_log_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_process_log_worker ON public.process_log USING btree (worker_id);


--
-- Name: idx_product_bom_sbom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_bom_sbom ON public.product_bom USING btree (sbom_id);


--
-- Name: idx_rule_cert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rule_cert_id ON public.certification_rule USING btree (cert_id);


--
-- Name: idx_rule_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rule_type ON public.certification_rule USING btree (rule_type);


--
-- Name: idx_self_wo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_wo_id ON public.self_inspection USING btree (wo_id);


--
-- Name: idx_structure_bom_cert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_structure_bom_cert ON public.structure_bom USING btree (cert_id);


--
-- Name: idx_tbm_attendee_tbm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbm_attendee_tbm ON public.tbm_attendee USING btree (tbm_id);


--
-- Name: idx_tbm_issue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbm_issue_status ON public.tbm_issue USING btree (status);


--
-- Name: idx_tbm_issue_tbm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbm_issue_tbm ON public.tbm_issue USING btree (tbm_id);


--
-- Name: idx_tbm_meeting_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tbm_meeting_date ON public.tbm_meeting USING btree (meeting_date);


--
-- Name: idx_wo_cert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wo_cert_id ON public.work_order USING btree (cert_id);


--
-- Name: idx_wo_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wo_date ON public.work_order USING btree (wo_date);


--
-- Name: idx_wo_process_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wo_process_code ON public.work_order USING btree (process_code);


--
-- Name: idx_wo_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wo_status ON public.work_order USING btree (status);


--
-- Name: approval approval_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.worker(worker_id);


--
-- Name: approval_line approval_line_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_line
    ADD CONSTRAINT approval_line_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.worker(worker_id);


--
-- Name: approval_line approval_line_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_line
    ADD CONSTRAINT approval_line_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.worker(worker_id);


--
-- Name: approval approval_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.worker(worker_id);


--
-- Name: approval approval_writer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval
    ADD CONSTRAINT approval_writer_id_fkey FOREIGN KEY (writer_id) REFERENCES public.worker(worker_id);


--
-- Name: bom_master bom_master_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_master
    ADD CONSTRAINT bom_master_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: bom_master bom_master_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_master
    ADD CONSTRAINT bom_master_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: cert_document cert_document_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_document
    ADD CONSTRAINT cert_document_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: certification_rule certification_rule_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certification_rule
    ADD CONSTRAINT certification_rule_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: closing_adjustment closing_adjustment_ci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_adjustment
    ADD CONSTRAINT closing_adjustment_ci_id_fkey FOREIGN KEY (ci_id) REFERENCES public.closing_item(ci_id);


--
-- Name: closing_adjustment closing_adjustment_closing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_adjustment
    ADD CONSTRAINT closing_adjustment_closing_id_fkey FOREIGN KEY (closing_id) REFERENCES public.inventory_closing(closing_id);


--
-- Name: closing_item closing_item_closing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closing_item
    ADD CONSTRAINT closing_item_closing_id_fkey FOREIGN KEY (closing_id) REFERENCES public.inventory_closing(closing_id);


--
-- Name: compounding_recipe_item compounding_recipe_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe_item
    ADD CONSTRAINT compounding_recipe_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: compounding_recipe_item compounding_recipe_item_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compounding_recipe_item
    ADD CONSTRAINT compounding_recipe_item_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.compounding_recipe(recipe_id);


--
-- Name: defect_record defect_record_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_record
    ADD CONSTRAINT defect_record_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.process_log(log_id);


--
-- Name: defect_record defect_record_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_record
    ADD CONSTRAINT defect_record_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.worker(worker_id);


--
-- Name: defect_record defect_record_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_record
    ADD CONSTRAINT defect_record_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: disposal_report disposal_report_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_report
    ADD CONSTRAINT disposal_report_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.worker(worker_id);


--
-- Name: disposal_report disposal_report_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_report
    ADD CONSTRAINT disposal_report_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.worker(worker_id);


--
-- Name: inspection inspection_cert_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT inspection_cert_doc_id_fkey FOREIGN KEY (cert_doc_id) REFERENCES public.cert_document(cert_doc_id);


--
-- Name: inspection inspection_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT inspection_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: inspection_detail inspection_detail_insp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection_detail
    ADD CONSTRAINT inspection_detail_insp_id_fkey FOREIGN KEY (insp_id) REFERENCES public.inspection(insp_id);


--
-- Name: inspection inspection_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT inspection_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lot_transaction(lot_id);


--
-- Name: inspection inspection_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT inspection_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: inventory_transaction inventory_transaction_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: inventory_transaction inventory_transaction_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lot_transaction(lot_id);


--
-- Name: inventory_transaction inventory_transaction_ref_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transaction
    ADD CONSTRAINT inventory_transaction_ref_wo_id_fkey FOREIGN KEY (ref_wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: loss_record loss_record_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_record
    ADD CONSTRAINT loss_record_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.process_log(log_id);


--
-- Name: loss_record loss_record_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_record
    ADD CONSTRAINT loss_record_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.worker(worker_id);


--
-- Name: loss_record loss_record_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loss_record
    ADD CONSTRAINT loss_record_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: lot_genealogy lot_genealogy_child_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_genealogy
    ADD CONSTRAINT lot_genealogy_child_lot_id_fkey FOREIGN KEY (child_lot_id) REFERENCES public.lot_transaction(lot_id);


--
-- Name: lot_genealogy lot_genealogy_parent_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_genealogy
    ADD CONSTRAINT lot_genealogy_parent_lot_id_fkey FOREIGN KEY (parent_lot_id) REFERENCES public.lot_transaction(lot_id);


--
-- Name: lot_properties lot_properties_inspection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_properties
    ADD CONSTRAINT lot_properties_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES public.inspection(insp_id);


--
-- Name: lot_properties lot_properties_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_properties
    ADD CONSTRAINT lot_properties_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.process_log(log_id);


--
-- Name: lot_properties lot_properties_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_properties
    ADD CONSTRAINT lot_properties_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.worker(worker_id);


--
-- Name: lot_transaction lot_transaction_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_transaction
    ADD CONSTRAINT lot_transaction_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: lot_transaction lot_transaction_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_transaction
    ADD CONSTRAINT lot_transaction_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: order_bom_result order_bom_result_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_bom_result
    ADD CONSTRAINT order_bom_result_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: order_bom_result order_bom_result_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_bom_result
    ADD CONSTRAINT order_bom_result_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_order(order_id) ON DELETE CASCADE;


--
-- Name: order_bom_result order_bom_result_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_bom_result
    ADD CONSTRAINT order_bom_result_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.sales_order_item(order_item_id) ON DELETE CASCADE;


--
-- Name: process_bom process_bom_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom
    ADD CONSTRAINT process_bom_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: process_bom_item process_bom_item_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom_item
    ADD CONSTRAINT process_bom_item_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.process_bom(bom_id) ON DELETE CASCADE;


--
-- Name: process_bom_item process_bom_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom_item
    ADD CONSTRAINT process_bom_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: process_bom process_bom_output_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_bom
    ADD CONSTRAINT process_bom_output_item_id_fkey FOREIGN KEY (output_item_id) REFERENCES public.item_master(item_id);


--
-- Name: process_event process_event_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_event
    ADD CONSTRAINT process_event_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.process_log(log_id);


--
-- Name: process_event process_event_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_event
    ADD CONSTRAINT process_event_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.worker(worker_id);


--
-- Name: process_issue process_issue_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_issue
    ADD CONSTRAINT process_issue_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.process_log(log_id);


--
-- Name: process_issue process_issue_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_issue
    ADD CONSTRAINT process_issue_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.worker(worker_id);


--
-- Name: process_issue process_issue_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_issue
    ADD CONSTRAINT process_issue_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: process_log process_log_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_log
    ADD CONSTRAINT process_log_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.process_bom(bom_id);


--
-- Name: process_log process_log_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_log
    ADD CONSTRAINT process_log_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: process_log process_log_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_log
    ADD CONSTRAINT process_log_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.worker(worker_id);


--
-- Name: product_bom product_bom_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bom
    ADD CONSTRAINT product_bom_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: product_bom product_bom_sbom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bom
    ADD CONSTRAINT product_bom_sbom_id_fkey FOREIGN KEY (sbom_id) REFERENCES public.structure_bom(sbom_id) ON DELETE CASCADE;


--
-- Name: purchase_request_item purchase_request_item_insp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_item
    ADD CONSTRAINT purchase_request_item_insp_id_fkey FOREIGN KEY (insp_id) REFERENCES public.inspection(insp_id);


--
-- Name: purchase_request_item purchase_request_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_item
    ADD CONSTRAINT purchase_request_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- Name: purchase_request_item purchase_request_item_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_item
    ADD CONSTRAINT purchase_request_item_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lot_transaction(lot_id);


--
-- Name: purchase_request_item purchase_request_item_pr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_item
    ADD CONSTRAINT purchase_request_item_pr_id_fkey FOREIGN KEY (pr_id) REFERENCES public.purchase_request(pr_id) ON DELETE CASCADE;


--
-- Name: purchase_request purchase_request_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request
    ADD CONSTRAINT purchase_request_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_order(order_id);


--
-- Name: sales_order_item sales_order_item_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_item
    ADD CONSTRAINT sales_order_item_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: sales_order_item sales_order_item_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_item
    ADD CONSTRAINT sales_order_item_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_order(order_id) ON DELETE CASCADE;


--
-- Name: self_inspection self_inspection_wo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_inspection
    ADD CONSTRAINT self_inspection_wo_id_fkey FOREIGN KEY (wo_id) REFERENCES public.work_order(wo_id);


--
-- Name: structure_bom structure_bom_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_bom
    ADD CONSTRAINT structure_bom_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: structure_bom structure_bom_output_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_bom
    ADD CONSTRAINT structure_bom_output_item_id_fkey FOREIGN KEY (output_item_id) REFERENCES public.item_master(item_id);


--
-- Name: tbm_attendee tbm_attendee_tbm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_attendee
    ADD CONSTRAINT tbm_attendee_tbm_id_fkey FOREIGN KEY (tbm_id) REFERENCES public.tbm_meeting(tbm_id) ON DELETE CASCADE;


--
-- Name: tbm_issue tbm_issue_tbm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tbm_issue
    ADD CONSTRAINT tbm_issue_tbm_id_fkey FOREIGN KEY (tbm_id) REFERENCES public.tbm_meeting(tbm_id);


--
-- Name: work_order work_order_cert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order
    ADD CONSTRAINT work_order_cert_id_fkey FOREIGN KEY (cert_id) REFERENCES public.certification_master(cert_id);


--
-- Name: work_order work_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order
    ADD CONSTRAINT work_order_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item_master(item_id);


--
-- PostgreSQL database dump complete
--

\unrestrict 3zMkV4CizO1MvBS5uGpb5XQbvVt26bBAH7IyIabIXjtF3aXMqM5lEDbBg01gGNm

