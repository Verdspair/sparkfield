import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CoursePack, SubjectId } from '@pkg/contracts';
import { gradeQuestionSubmission } from '@pkg/learning-core';
import {
  QuestionStepCard,
  type QuestionAnswerSubmission,
  type QuestionFeedbackView,
} from '@pkg/learning-ui';
import {
  compileCoursePack,
  type CoursePackMeta,
  type Diagnostic,
} from '@pkg/pack-compiler';
import {
  httpClient,
  type AdminPackListItem,
  type AdminUserRow,
  type AnonymousErrorRateRow,
} from '../api/httpClient.js';
import { getStarterAuthoringTemplate } from '../content/starterPacks.js';
import { useAppStore } from '../store/appStore.js';

const SHORT_SUBJECT: Readonly<Record<SubjectId, string>> = {
  english: '英语',
  math: '数学',
};

export function AdminPackDrawer({
  onClose,
}: {
  readonly onClose: () => void;
}): React.JSX.Element {
  const { authMode, profile, audioBus, setExternalLearningOverlay, pushToast } = useAppStore();

  const canPublishServer =
    authMode === 'authenticated' &&
    (profile?.role === 'admin' || profile?.role === 'editor');
  const isAdmin = authMode === 'authenticated' && profile?.role === 'admin';

  const [workbenchTab, setWorkbenchTab] = useState<'pack_pipeline' | 'analytics' | 'users'>(
    'pack_pipeline',
  );
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const initialTpl = getStarterAuthoringTemplate('english');
  const [meta, setMeta] = useState<CoursePackMeta>(initialTpl.meta);
  const [knowledgeGraphText, setKnowledgeGraphText] = useState<string>(() =>
    JSON.stringify(initialTpl.meta.knowledgeGraph, null, 2),
  );
  const [csvText, setCsvText] = useState<string>(initialTpl.csvText);
  const [mdText, setMdText] = useState<string>(initialTpl.mdText);

  const [compiling, setCompiling] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [compiledPack, setCompiledPack] = useState<CoursePack | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const sourceRevisionRef = useRef(0);
  const compileInFlightRef = useRef(false);
  const [sandboxIdx, setSandboxIdx] = useState<number>(0);
  const [sandboxFeedback, setSandboxFeedback] = useState<QuestionFeedbackView | null>(null);

  const [packVersions, setPackVersions] = useState<AdminPackListItem[]>([]);
  const [publishing, setPublishing] = useState<boolean>(false);

  const [errorRates, setErrorRates] = useState<AnonymousErrorRateRow[]>([]);
  const [filterCohortGroup, setFilterCohortGroup] = useState<string>('');
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [resetTargetUserId, setResetTargetUserId] = useState<string>('');
  const [resetNewPassword, setResetNewPassword] = useState<string>('');
  const [identityVerified, setIdentityVerified] = useState<boolean>(false);

  useEffect(() => {
    setExternalLearningOverlay('admin-workbench-sandbox', step === 4);
    return () => setExternalLearningOverlay('admin-workbench-sandbox', false);
  }, [setExternalLearningOverlay, step]);

  const loadAdminMetadata = useCallback(async () => {
    if (!canPublishServer) return;
    try {
      const [versions, rates] = await Promise.all([
        httpClient.listAdminPacks(),
        httpClient.getAnonymousErrorRates(),
      ]);
      setPackVersions(versions);
      setErrorRates(rates);
      if (isAdmin) {
        const users = await httpClient.listAdminUsers();
        setAdminUsers(users);
      }
    } catch {
      return;
    }
  }, [canPublishServer, isAdmin]);

  useEffect(() => {
    void loadAdminMetadata();
  }, [loadAdminMetadata]);

  const invalidateCompiledDraft = () => {
    sourceRevisionRef.current += 1;
    setDiagnostics([]);
    setCompiledPack(null);
    setDraftId(null);
    setSandboxFeedback(null);
  };

  const handleLoadTemplate = (subject: SubjectId) => {
    invalidateCompiledDraft();
    const tpl = getStarterAuthoringTemplate(subject);
    setMeta(tpl.meta);
    setKnowledgeGraphText(JSON.stringify(tpl.meta.knowledgeGraph, null, 2));
    setCsvText(tpl.csvText);
    setMdText(tpl.mdText);
    pushToast(`已载入${SHORT_SUBJECT[subject]}模板`, 'info');
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'csv' | 'md',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    invalidateCompiledDraft();
    if (kind === 'csv') setCsvText(text);
    else setMdText(text);
    pushToast(`已读取 ${file.name}`, 'success');
  };

  const handleCompile = async () => {
    if (compileInFlightRef.current) return;
    compileInFlightRef.current = true;
    invalidateCompiledDraft();
    const revision = sourceRevisionRef.current;
    setCompiling(true);

    let parsedGraph = meta.knowledgeGraph;
    try {
      parsedGraph = JSON.parse(knowledgeGraphText) as CoursePackMeta['knowledgeGraph'];
    } catch {
      setDiagnostics([
        {
          file: 'pack-meta.json',
          line: 1,
          field: 'knowledgeGraph',
          message: 'JSON 语法错误，请检查括号与逗号',
        },
      ]);
      compileInFlightRef.current = false;
      setCompiling(false);
      setStep(3);
      return;
    }

    const inputPayload = {
      meta: { ...meta, knowledgeGraph: parsedGraph },
      metaSourceName: 'pack-meta.json',
      csvSources: csvText.trim() ? [{ file: 'questions.csv', text: csvText }] : [],
      mdSources: mdText.trim() ? [{ file: 'lessons.md', text: mdText }] : [],
      createdAtIso: new Date().toISOString(),
    };

    try {
      if (canPublishServer) {
        const serverRes = await httpClient.compileCoursePackPreview(inputPayload);
        if (revision !== sourceRevisionRef.current) return;
        if (!serverRes.ok) {
          setDiagnostics(serverRes.diagnostics);
          setStep(3);
          return;
        }
        setCompiledPack(serverRes.pack);
        setDraftId(serverRes.draftId);
        setSandboxIdx(0);
        setSandboxFeedback(null);
        setStep(3);
        pushToast(`编译通过，共 ${serverRes.manifest.itemCount} 题`, 'success');
      } else {
        const localRes = compileCoursePack(inputPayload);
        if (!localRes.ok) {
          setDiagnostics(localRes.diagnostics);
          setStep(3);
          return;
        }
        setCompiledPack(localRes.pack);
        setDraftId('local-sandbox-draft');
        setSandboxIdx(0);
        setSandboxFeedback(null);
        setStep(3);
        pushToast(`本地编译通过，共 ${localRes.pack.manifest.itemCount} 题`, 'success');
      }
    } catch (err) {
      if (revision === sourceRevisionRef.current) {
        pushToast(err instanceof Error ? err.message : '编译请求失败', 'error');
      }
    } finally {
      compileInFlightRef.current = false;
      setCompiling(false);
    }
  };

  const handleSandboxSubmit = (sub: QuestionAnswerSubmission) => {
    if (!compiledPack) return;
    const item = compiledPack.items[sandboxIdx];
    if (!item) return;
    const grade = gradeQuestionSubmission(item, {
      answer: sub.answer,
      status: sub.status,
      hintUsed: sub.hintUsed,
    });
    setSandboxFeedback({
      questionId: item.questionId,
      isCorrect: grade.isCorrect,
      isSkipped: grade.isSkipped,
      quality: grade.quality,
      explanationMd: item.explanationMd,
      correctAnswerDisplay: item.answerSpec,
      stepResults: grade.stepResults.map((s) => ({
        stepId: s.stepId,
        isCorrect: s.isCorrect,
      })),
    });
  };

  const handlePublishDraft = async () => {
    if (!draftId || !isAdmin || draftId === 'local-sandbox-draft') return;
    setPublishing(true);
    try {
      const res = await httpClient.publishCoursePackDraft(draftId, true);
      pushToast(
        `已发布 ${res.manifest.packId}@${res.manifest.coursePackVersion}`,
        'success',
      );
      await loadAdminMetadata();
      setStep(5);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '发布失败', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (packId: string, version: string) => {
    if (!isAdmin) return;
    try {
      await httpClient.rollbackOrActivatePackVersion(packId, version);
      pushToast(`已切换至 ${packId} v${version}`, 'success');
      await loadAdminMetadata();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '版本切换失败', 'error');
    }
  };

  const handleExportExisting = async (packId: string, version: string) => {
    try {
      const exported = await httpClient.exportAdminPackAuthoring(packId, version);
      invalidateCompiledDraft();
      setMeta(exported.meta);
      setKnowledgeGraphText(JSON.stringify(exported.meta.knowledgeGraph, null, 2));
      setCsvText(exported.csvText);
      setMdText(exported.mdText);
      setStep(2);
      pushToast(`已导出 ${packId}@${version}`, 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  };

  const handleDownloadAnonymousCsv = async () => {
    try {
      const csv = await httpClient.exportAnonymousErrorRatesCsv({
        ...(filterCohortGroup.trim() ? { cohortGroup: filterCohortGroup.trim() } : {}),
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'anonymous-error-rates.csv';
      a.click();
      URL.revokeObjectURL(url);
      pushToast('已导出 CSV', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  };

  const handleAdminPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityVerified || !resetTargetUserId || resetNewPassword.length < 6) return;
    try {
      await httpClient.adminResetPassword({
        userId: resetTargetUserId,
        newPassword: resetNewPassword,
        identityVerified: true,
      });
      setResetNewPassword('');
      setIdentityVerified(false);
      pushToast('密码已重置', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '重置失败', 'error');
    }
  };

  const activeSandboxItem = compiledPack?.items[sandboxIdx] ?? null;

  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="题库工作台"
      data-testid="admin-pack-workbench"
    >
      <div
        className="ui-frosted-panel blc-workbench-modal"
        style={{
          borderRadius: 10,
          border: '1px solid rgba(240, 220, 170, 0.28)',
          background: 'rgba(13, 17, 26, 0.92)',
        }}
      >
        <header className="blc-workbench-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>题库工作台</h2>
            <span className="blc-chip blc-chip--gold">
              {isAdmin ? '管理员' : canPublishServer ? '编辑' : '本地沙盒'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="blc-seg-tabs">
              <button
                type="button"
                className={`blc-seg-tab ${workbenchTab === 'pack_pipeline' ? 'blc-seg-tab--active' : ''}`}
                onClick={() => setWorkbenchTab('pack_pipeline')}
                data-testid="wb-tab-pipeline"
              >
                题库导入
              </button>
              <button
                type="button"
                className={`blc-seg-tab ${workbenchTab === 'analytics' ? 'blc-seg-tab--active' : ''}`}
                onClick={() => setWorkbenchTab('analytics')}
                data-testid="wb-tab-analytics"
              >
                错题统计
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className={`blc-seg-tab ${workbenchTab === 'users' ? 'blc-seg-tab--active' : ''}`}
                  onClick={() => setWorkbenchTab('users')}
                  data-testid="wb-tab-users"
                >
                  账号管理
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="blc-btn blc-btn--ghost blc-btn--xs"
              onClick={onClose}
              data-testid="close-admin-workbench-btn"
            >
              ✕
            </button>
          </div>
        </header>

        {workbenchTab === 'pack_pipeline' ? (
          <div className="blc-workbench-body">
            <nav className="blc-five-step-bar" aria-label="导入步骤">
              {[
                { n: 1 as const, label: '1. 基本信息' },
                { n: 2 as const, label: '2. 题表与讲义' },
                { n: 3 as const, label: '3. 编译校验' },
                { n: 4 as const, label: '4. 沙盒试做' },
                { n: 5 as const, label: '5. 版本发布' },
              ].map((s) => (
                <button
                  key={s.n}
                  type="button"
                  className={`blc-step-btn ${step === s.n ? 'blc-step-btn--active' : ''}`}
                  onClick={() => setStep(s.n)}
                  data-testid={`pack-step-${s.n}`}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="blc-workbench-scroll">
              {step === 1 ? (
                <div className="blc-form-stack">
                  <div className="blc-btn-bar">
                    <button
                      type="button"
                      className="blc-btn blc-btn--metal blc-btn--sm"
                      onClick={() => handleLoadTemplate('english')}
                      data-testid="load-english-template-btn"
                    >
                      载入英语模板
                    </button>
                    <button
                      type="button"
                      className="blc-btn blc-btn--metal blc-btn--sm"
                      onClick={() => handleLoadTemplate('math')}
                      data-testid="load-math-template-btn"
                    >
                      载入数学模板
                    </button>
                  </div>

                  <div className="blc-two-col-grid">
                    <label className="blc-field">
                      <span className="blc-field__label">题库标识</span>
                      <input
                        className="blc-input"
                        value={meta.packId}
                        onChange={(e) => { invalidateCompiledDraft(); setMeta({ ...meta, packId: e.target.value }); }}
                      />
                    </label>
                    <label className="blc-field">
                      <span className="blc-field__label">版本号</span>
                      <input
                        className="blc-input"
                        value={meta.coursePackVersion}
                        onChange={(e) => { invalidateCompiledDraft(); setMeta({ ...meta, coursePackVersion: e.target.value }); }}
                      />
                    </label>
                    <label className="blc-field">
                      <span className="blc-field__label">学科</span>
                      <select
                        className="blc-select"
                        value={meta.subject}
                        onChange={(e) => {
                          invalidateCompiledDraft();
                          setMeta({ ...meta, subject: e.target.value as SubjectId });
                        }}
                      >
                        <option value="english">英语</option>
                        <option value="math">数学</option>
                      </select>
                    </label>
                    <label className="blc-field">
                      <span className="blc-field__label">标题</span>
                      <input
                        className="blc-input"
                        value={meta.title}
                        onChange={(e) => { invalidateCompiledDraft(); setMeta({ ...meta, title: e.target.value }); }}
                      />
                    </label>
                  </div>

                  <label className="blc-field">
                    <span className="blc-field__label">章节图谱 JSON</span>
                    <textarea
                      className="blc-code-area"
                      rows={7}
                      value={knowledgeGraphText}
                      onChange={(e) => { invalidateCompiledDraft(); setKnowledgeGraphText(e.target.value); }}
                    />
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary"
                      onClick={() => setStep(2)}
                    >
                      下一步 →
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="blc-form-stack">
                  <div className="blc-two-col-grid">
                    <div className="blc-field">
                      <div className="blc-col-head">
                        <span className="blc-field__label">结构化题表 (questions.csv)</span>
                        <label className="blc-btn blc-btn--ghost blc-btn--xs" style={{ cursor: 'pointer' }}>
                          上传 CSV
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            style={{ display: 'none' }}
                            onChange={(e) => void handleFileUpload(e, 'csv')}
                          />
                        </label>
                      </div>
                      <textarea
                        className="blc-code-area"
                        rows={13}
                        value={csvText}
                        onChange={(e) => { invalidateCompiledDraft(); setCsvText(e.target.value); }}
                        data-testid="pack-csv-editor"
                      />
                    </div>

                    <div className="blc-field">
                      <div className="blc-col-head">
                        <span className="blc-field__label">讲义与多步题 (lessons.md)</span>
                        <label className="blc-btn blc-btn--ghost blc-btn--xs" style={{ cursor: 'pointer' }}>
                          上传 MD
                          <input
                            type="file"
                            accept=".md,text/markdown"
                            style={{ display: 'none' }}
                            onChange={(e) => void handleFileUpload(e, 'md')}
                          />
                        </label>
                      </div>
                      <textarea
                        className="blc-code-area"
                        rows={13}
                        value={mdText}
                        onChange={(e) => { invalidateCompiledDraft(); setMdText(e.target.value); }}
                        data-testid="pack-md-editor"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      className="blc-btn blc-btn--ghost"
                      onClick={() => setStep(1)}
                    >
                      ← 上一步
                    </button>
                    <button
                      type="button"
                      className="blc-btn blc-btn--primary"
                      disabled={compiling}
                      onClick={() => void handleCompile()}
                      data-testid="compile-pack-btn"
                    >
                      {compiling ? '编译中…' : '编译校验 →'}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="blc-form-stack" data-testid="pack-compile-diagnostics">
                  {diagnostics.length > 0 ? (
                    <div className="blc-alert blc-alert--error" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <strong>发现 {diagnostics.length} 处校验问题</strong>
                      <table className="blc-table" style={{ marginTop: 8 }}>
                        <thead>
                          <tr>
                            <th>文件</th>
                            <th>位置</th>
                            <th>字段</th>
                            <th>说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diagnostics.map((d, idx) => (
                            <tr key={idx}>
                              <td><code>{d.file}</code></td>
                              <td>{d.line}{d.column ? `:${d.column}` : ''}</td>
                              <td><code>{d.field}</code></td>
                              <td>{d.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : compiledPack ? (
                    <div className="ui-frosted-panel" style={{ padding: 16 }}>
                      <h3 style={{ marginTop: 0, color: 'var(--gold-light)' }}>编译通过</h3>
                      <p style={{ margin: '6px 0', fontSize: 13.5 }}>
                        <strong>{compiledPack.manifest.packId}</strong> · v
                        {compiledPack.manifest.coursePackVersion} ·{' '}
                        {compiledPack.manifest.itemCount} 题
                      </p>
                      <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        <code>{compiledPack.manifest.contentSha256}</code>
                      </p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button
                          type="button"
                          className="blc-btn blc-btn--primary"
                          onClick={() => setStep(4)}
                          data-testid="goto-sandbox-step-btn"
                        >
                          沙盒试做 →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="blc-empty-box">
                      尚未执行编译
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="blc-btn blc-btn--primary"
                          onClick={() => void handleCompile()}
                        >
                          运行编译
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="blc-form-stack" data-testid="pack-sandbox-step">
                  {!compiledPack || !activeSandboxItem ? (
                    <div className="blc-empty-box">请先完成编译</div>
                  ) : (
                    <>
                      <div className="blc-col-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span>题目 ({compiledPack.items.length})</span>
                          <select
                            className="blc-select"
                            style={{ width: 320 }}
                            value={sandboxIdx}
                            onChange={(e) => {
                              setSandboxIdx(Number(e.target.value));
                              setSandboxFeedback(null);
                            }}
                            data-testid="sandbox-question-select"
                          >
                            {compiledPack.items.map((it, idx) => (
                              <option key={it.questionId} value={idx}>
                                #{idx + 1} · {it.questionId} ({it.questionType})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="blc-btn blc-btn--ghost blc-btn--sm"
                            onClick={() => setSandboxFeedback(null)}
                          >
                            重置
                          </button>
                          <button
                            type="button"
                            className="blc-btn blc-btn--primary blc-btn--sm"
                            onClick={() => setStep(5)}
                          >
                            下一步 →
                          </button>
                        </div>
                      </div>

                      <div style={{ maxHeight: '78vh', overflow: 'auto' }}>
                        <QuestionStepCard
                          stepKind={activeSandboxItem.stepRole}
                          question={activeSandboxItem}
                          feedback={sandboxFeedback}
                          variant="sandbox"
                          audioBus={audioBus}
                          nextStepLabel="下一题 →"
                          onSubmitAnswer={handleSandboxSubmit}
                          onSkipQuestion={handleSandboxSubmit}
                          onAdvanceStep={() => {
                            setSandboxFeedback(null);
                            setSandboxIdx((i) => (i + 1) % compiledPack.items.length);
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {step === 5 ? (
                <div className="blc-form-stack" data-testid="pack-publish-step">
                  <div className="ui-frosted-panel" style={{ padding: 14 }}>
                    <div className="blc-col-head">
                      <strong>发布当前版本</strong>
                      <button
                        type="button"
                        className="blc-btn blc-btn--primary blc-btn--sm"
                        disabled={
                          !isAdmin ||
                          !draftId ||
                          draftId === 'local-sandbox-draft' ||
                          publishing
                        }
                        onClick={() => void handlePublishDraft()}
                        data-testid="publish-pack-draft-btn"
                      >
                        {!isAdmin
                          ? '需管理员权限'
                          : !draftId
                            ? '请先编译'
                            : publishing
                              ? '发布中…'
                              : '发布并激活'}
                      </button>
                    </div>
                  </div>

                  <div className="ui-frosted-panel" style={{ padding: 14 }}>
                    <h4 style={{ marginTop: 0 }}>已归档版本</h4>
                    {packVersions.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        暂无版本记录
                      </div>
                    ) : (
                      <table className="blc-table">
                        <thead>
                          <tr>
                            <th>标识</th>
                            <th>版本</th>
                            <th>规模</th>
                            <th>状态</th>
                            <th style={{ textAlign: 'right' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {packVersions.map((pv) => (
                            <tr key={`${pv.manifest.packId}:${pv.manifest.coursePackVersion}`}>
                              <td><code>{pv.manifest.packId}</code></td>
                              <td><strong>v{pv.manifest.coursePackVersion}</strong></td>
                              <td>
                                {SHORT_SUBJECT[pv.manifest.subject]} · {pv.manifest.itemCount} 题
                              </td>
                              <td>
                                {pv.isActive ? (
                                  <span className="blc-chip blc-chip--gold">当前激活</span>
                                ) : (
                                  <span className="blc-chip">历史归档</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="blc-btn blc-btn--ghost blc-btn--xs"
                                    onClick={() =>
                                      void handleExportExisting(
                                        pv.manifest.packId,
                                        pv.manifest.coursePackVersion,
                                      )
                                    }
                                  >
                                    导出
                                  </button>
                                  {!pv.isActive && isAdmin ? (
                                    <button
                                      type="button"
                                      className="blc-btn blc-btn--primary blc-btn--xs"
                                      onClick={() =>
                                        void handleRollback(
                                          pv.manifest.packId,
                                          pv.manifest.coursePackVersion,
                                        )
                                      }
                                    >
                                      回滚
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {workbenchTab === 'analytics' ? (
          <div className="blc-workbench-body">
            <div className="blc-workbench-scroll">
              <div className="blc-col-head">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    className="blc-input"
                    style={{ width: 200 }}
                    placeholder="按分组过滤"
                    value={filterCohortGroup}
                    onChange={(e) => setFilterCohortGroup(e.target.value)}
                  />
                  <button
                    type="button"
                    className="blc-btn blc-btn--metal blc-btn--sm"
                    disabled={!canPublishServer}
                    onClick={() =>
                      void httpClient
                        .getAnonymousErrorRates({
                          ...(filterCohortGroup.trim()
                            ? { cohortGroup: filterCohortGroup.trim() }
                            : {}),
                        })
                        .then(setErrorRates)
                    }
                  >
                    查询
                  </button>
                </div>

                <button
                  type="button"
                  className="blc-btn blc-btn--primary blc-btn--sm"
                  disabled={!canPublishServer}
                  onClick={() => void handleDownloadAnonymousCsv()}
                  data-testid="export-anonymous-csv-btn"
                >
                  导出 CSV
                </button>
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                少于 3 人的分组自动隐去数据。
              </p>

              {errorRates.length === 0 ? (
                <div className="blc-empty-box">暂无统计记录</div>
              ) : (
                <table className="blc-table">
                  <thead>
                    <tr>
                      <th>分组</th>
                      <th>学科</th>
                      <th>样本数</th>
                      <th>作答数</th>
                      <th>错题率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRates.map((r) => (
                      <tr key={`${r.cohortGroup}:${r.subject}`}>
                        <td><strong>{r.cohortGroup}</strong></td>
                        <td>{SHORT_SUBJECT[r.subject]}</td>
                        <td>{r.suppressed ? '<3' : r.sampleSize}</td>
                        <td>{r.suppressed ? '—' : r.attemptCount}</td>
                        <td>
                          {r.suppressed || r.wrongRate === null
                            ? '—'
                            : `${(r.wrongRate * 100).toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        {workbenchTab === 'users' && isAdmin ? (
          <div className="blc-workbench-body">
            <div className="blc-workbench-scroll blc-two-col-grid">
              <form
                className="ui-frosted-panel blc-form-stack"
                style={{ padding: 16 }}
                onSubmit={(e) => void handleAdminPasswordReset(e)}
                data-testid="admin-reset-password-form"
              >
                <h3 style={{ marginTop: 0 }}>密码重置</h3>
                <label className="blc-field">
                  <span className="blc-field__label">目标账号</span>
                  <select
                    className="blc-select"
                    value={resetTargetUserId}
                    onChange={(e) => setResetTargetUserId(e.target.value)}
                    required
                  >
                    <option value="">选择账号</option>
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.nickname} · {u.role})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blc-field">
                  <span className="blc-field__label">新密码</span>
                  <input
                    type="password"
                    className="blc-input"
                    minLength={6}
                    placeholder="至少 6 位"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                  />
                </label>

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={identityVerified}
                    onChange={(e) => setIdentityVerified(e.target.checked)}
                  />
                  <span>已核实账号归属人身份</span>
                </label>

                <button
                  type="submit"
                  className="blc-btn blc-btn--primary"
                  disabled={!identityVerified || !resetTargetUserId || resetNewPassword.length < 6}
                >
                  重置密码
                </button>
              </form>

              <div className="ui-frosted-panel" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>账号列表 ({adminUsers.length})</h3>
                <div style={{ maxHeight: 340, overflow: 'auto' }}>
                  <table className="blc-table">
                    <thead>
                      <tr>
                        <th>账号</th>
                        <th>角色</th>
                        <th>分组标识</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.nickname}</strong>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {u.username}
                            </div>
                          </td>
                          <td>{u.role}</td>
                          <td>
                            <input
                              className="blc-input"
                              style={{ padding: '4px 8px', minHeight: 32, width: 130 }}
                              defaultValue={u.cohort_group ?? ''}
                              placeholder="分组标识"
                              onBlur={(e) => {
                                const val = e.target.value.trim() || null;
                                if (val !== u.cohort_group) {
                                  void httpClient
                                    .updateUserCohortGroup(u.id, val)
                                    .then(() => {
                                      setAdminUsers((users) => users.map((user) =>
                                        user.id === u.id ? { ...user, cohort_group: val } : user,
                                      ));
                                      pushToast(`已更新 ${u.nickname} 的分组`, 'success');
                                    })
                                    .catch((err) =>
                                      pushToast(
                                        err instanceof Error ? err.message : '更新分组失败',
                                        'error',
                                      ),
                                    );
                                }
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
