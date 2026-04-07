import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 인정기준 적합성 검증 API
 * 설계서 1.5절: 7대 핵심 규칙
 * - AREA: 개구부 면적 ≤ 인정면적 (MAX)
 * - GAP: 틈새간격 ≤ 인정값 (MAX)
 * - PIPE: 관통 배관 직경 ≤ 인정값 (MAX)
 * - THICKNESS: 시트 두께 ≥ 인정값 (MIN)
 * - DENSITY: 시트 밀도 ≥ 인정값 (MIN)
 * - MASS: CW 밀도 ≥ 인정값 (MIN)
 * - LENGTH/WIDTH: 치수 공차 이내
 */
interface CheckInput {
  opening_area_sqmm?: number;   // 개구부 면적 (mm²)
  gap_mm?: number;              // 틈새간격 (mm)
  pipe_diameter_mm?: number;    // 배관 직경 (mm)
  sheet_thickness_mm?: number;  // 시트 두께 (mm)
  sheet_density_kgm3?: number;  // 시트 밀도 (kg/m³)
  cw_density_kgm3?: number;     // CW 밀도 (kg/m³)
}

interface CheckResult {
  rule_id: number;
  rule_type: string;
  cert_value: number;
  direction: string;
  input_value: number | null;
  tolerance: number | null;
  production_value: number | null;
  unit: string | null;
  description: string | null;
  result: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}

export async function certCheckRoutes(app: FastifyInstance) {
  // POST /api/cert-check/verify - 인정기준 적합성 검증
  app.post('/api/cert-check/verify', async (request, reply) => {
    const { cert_id, inputs } = request.body as {
      cert_id: number;
      inputs: CheckInput;
    };

    if (!cert_id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'cert_id는 필수입니다.' });
    }

    // 인정구조 정보 조회
    const certResult = await pool.query(
      'SELECT * FROM certification_master WHERE cert_id = $1',
      [cert_id]
    );
    if (certResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '인정구조를 찾을 수 없습니다.' });
    }
    const cert = certResult.rows[0];

    // 해당 인정구조의 규칙 조회
    const rulesResult = await pool.query(
      'SELECT * FROM certification_rule WHERE cert_id = $1 ORDER BY rule_id',
      [cert_id]
    );

    const results: CheckResult[] = [];

    for (const rule of rulesResult.rows) {
      const ruleType = rule.rule_type as string;
      const certValue = parseFloat(rule.cert_value);
      const direction = rule.direction as string;
      const tolerance = rule.tolerance_plus ? parseFloat(rule.tolerance_plus) : null;
      const prodValue = rule.production_value ? parseFloat(rule.production_value) : null;

      // 입력값 매핑
      let inputValue: number | null = null;
      switch (ruleType) {
        case 'AREA':
          inputValue = inputs.opening_area_sqmm ?? null;
          break;
        case 'GAP':
          inputValue = inputs.gap_mm ?? null;
          break;
        case 'PIPE':
          inputValue = inputs.pipe_diameter_mm ?? null;
          break;
        case 'THICKNESS':
          inputValue = inputs.sheet_thickness_mm ?? null;
          break;
        case 'DENSITY':
          inputValue = inputs.sheet_density_kgm3 ?? null;
          break;
        case 'MASS':
          inputValue = inputs.cw_density_kgm3 ?? null;
          break;
        default:
          inputValue = null;
      }

      let result: 'PASS' | 'FAIL' | 'SKIP' = 'SKIP';
      let message = '';

      if (inputValue == null) {
        result = 'SKIP';
        message = '입력값 없음 (검증 생략)';
      } else if (direction === 'MAX') {
        // MAX: 입력값 ≤ 인정값이면 PASS
        if (inputValue <= certValue) {
          result = 'PASS';
          message = `${inputValue} ≤ ${certValue} (적합)`;
        } else {
          result = 'FAIL';
          message = `${inputValue} > ${certValue} (기준 초과)`;
        }
      } else if (direction === 'MIN') {
        // MIN: 입력값 ≥ 인정값이면 PASS
        if (tolerance != null) {
          // 공차 적용: 입력값 ≥ (생산값 - 공차)
          const lowerBound = (prodValue ?? certValue) - tolerance;
          if (inputValue >= lowerBound) {
            result = 'PASS';
            message = `${inputValue} ≥ ${lowerBound} (인정기준 ${certValue}, 생산값 ${prodValue ?? '-'}, 공차 -${tolerance})`;
          } else {
            result = 'FAIL';
            message = `${inputValue} < ${lowerBound} (기준 미달)`;
          }
        } else {
          if (inputValue >= certValue) {
            result = 'PASS';
            message = `${inputValue} ≥ ${certValue} (적합)`;
          } else {
            result = 'FAIL';
            message = `${inputValue} < ${certValue} (기준 미달)`;
          }
        }
      }

      results.push({
        rule_id: rule.rule_id,
        rule_type: ruleType,
        cert_value: certValue,
        direction,
        input_value: inputValue,
        tolerance,
        production_value: prodValue,
        unit: rule.unit,
        description: rule.description,
        result,
        message,
      });
    }

    const checkedResults = results.filter((r) => r.result !== 'SKIP');
    const overallResult =
      checkedResults.length === 0
        ? 'SKIP'
        : checkedResults.every((r) => r.result === 'PASS')
          ? 'PASS'
          : 'FAIL';

    return {
      data: {
        cert_id: cert.cert_id,
        cert_number: cert.cert_number,
        structure_code: cert.structure_code,
        overall_result: overallResult,
        checked_count: checkedResults.length,
        pass_count: checkedResults.filter((r) => r.result === 'PASS').length,
        fail_count: checkedResults.filter((r) => r.result === 'FAIL').length,
        results,
      },
    };
  });

  // POST /api/cert-check/find-applicable - 적용 가능한 인정구조 검색
  app.post('/api/cert-check/find-applicable', async (request, reply) => {
    const inputs = request.body as CheckInput;

    // 모든 활성 인정구조 조회
    const certs = await pool.query(
      'SELECT * FROM certification_master WHERE is_active = true ORDER BY cert_number'
    );

    const applicableList = [];

    for (const cert of certs.rows) {
      const rules = await pool.query(
        'SELECT * FROM certification_rule WHERE cert_id = $1',
        [cert.cert_id]
      );

      let allPass = true;
      let hasChecked = false;
      const ruleResults: Array<{ rule_type: string; result: string }> = [];

      for (const rule of rules.rows) {
        const certValue = parseFloat(rule.cert_value);
        const direction = rule.direction as string;
        let inputValue: number | null = null;

        switch (rule.rule_type) {
          case 'AREA': inputValue = inputs.opening_area_sqmm ?? null; break;
          case 'GAP': inputValue = inputs.gap_mm ?? null; break;
          case 'PIPE': inputValue = inputs.pipe_diameter_mm ?? null; break;
          case 'THICKNESS': inputValue = inputs.sheet_thickness_mm ?? null; break;
          case 'DENSITY': inputValue = inputs.sheet_density_kgm3 ?? null; break;
          case 'MASS': inputValue = inputs.cw_density_kgm3 ?? null; break;
        }

        if (inputValue == null) {
          ruleResults.push({ rule_type: rule.rule_type, result: 'SKIP' });
          continue;
        }

        hasChecked = true;
        let pass = false;
        if (direction === 'MAX') {
          pass = inputValue <= certValue;
        } else {
          pass = inputValue >= certValue;
        }

        ruleResults.push({ rule_type: rule.rule_type, result: pass ? 'PASS' : 'FAIL' });
        if (!pass) allPass = false;
      }

      if (hasChecked && allPass) {
        applicableList.push({
          cert_id: cert.cert_id,
          cert_number: cert.cert_number,
          structure_code: cert.structure_code,
          product_group: cert.product_group,
          socket_name: cert.socket_name,
          opening_w_mm: cert.opening_w_mm,
          opening_h_mm: cert.opening_h_mm,
          gap_limit_mm: cert.gap_limit_mm,
          rule_results: ruleResults,
        });
      }
    }

    return {
      data: applicableList,
      total: applicableList.length,
    };
  });
}
