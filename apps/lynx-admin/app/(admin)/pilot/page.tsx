"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs } from "@/components/tabs";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/ui";
import {
  createPilotInvitation,
  listPilotInvitations,
  listPilotParticipants,
  revokePilotInvitation,
  updatePilotParticipant,
} from "@/lib/admin-api";
import type {
  AccessInvitationList,
  AccessInvitationStatus,
  PilotParticipantList,
  PilotParticipantStatus,
} from "@/lib/admin-types";
import { formatDate } from "@/lib/format";

export default function PilotPage() {
  const [tab, setTab] = useState("invite");
  const [email, setEmail] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("72");
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [invitations, setInvitations] = useState<AccessInvitationList | null>(
    null,
  );
  const [invitationStatus, setInvitationStatus] = useState("");
  const [invitationCursor, setInvitationCursor] = useState<string>();
  const [invitationHistory, setInvitationHistory] = useState<
    Array<string | undefined>
  >([]);
  const [participants, setParticipants] = useState<PilotParticipantList | null>(
    null,
  );
  const [participantSearch, setParticipantSearch] = useState("");
  const [appliedParticipantSearch, setAppliedParticipantSearch] = useState("");
  const [participantStatus, setParticipantStatus] = useState("");
  const [participantCursor, setParticipantCursor] = useState<string>();
  const [participantHistory, setParticipantHistory] = useState<
    Array<string | undefined>
  >([]);
  const [invitationError, setInvitationError] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [changingId, setChangingId] = useState("");

  const loadInvitations = useCallback(() => {
    setInvitationError("");
    return listPilotInvitations({
      status: invitationStatus || undefined,
      cursor: invitationCursor,
      limit: "25",
    })
      .then(setInvitations)
      .catch((cause: unknown) => {
        setInvitationError(
          cause instanceof Error ? cause.message : "초대 조회에 실패했습니다.",
        );
      });
  }, [invitationCursor, invitationStatus]);

  const loadParticipants = useCallback(() => {
    setParticipantError("");
    return listPilotParticipants({
      search: appliedParticipantSearch || undefined,
      status: participantStatus || undefined,
      cursor: participantCursor,
      limit: "25",
    })
      .then(setParticipants)
      .catch((cause: unknown) => {
        setParticipantError(
          cause instanceof Error
            ? cause.message
            : "파일럿 사용자 조회에 실패했습니다.",
        );
      });
  }, [appliedParticipantSearch, participantCursor, participantStatus]);

  useEffect(() => {
    let isCurrent = true;
    listPilotInvitations({
      status: invitationStatus || undefined,
      cursor: invitationCursor,
      limit: "25",
    })
      .then((result) => {
        if (isCurrent) {
          setInvitationError("");
          setInvitations(result);
        }
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setInvitationError(
            cause instanceof Error
              ? cause.message
              : "초대 조회에 실패했습니다.",
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [invitationCursor, invitationStatus]);

  useEffect(() => {
    let isCurrent = true;
    listPilotParticipants({
      search: appliedParticipantSearch || undefined,
      status: participantStatus || undefined,
      cursor: participantCursor,
      limit: "25",
    })
      .then((result) => {
        if (isCurrent) {
          setParticipantError("");
          setParticipants(result);
        }
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setParticipantError(
            cause instanceof Error
              ? cause.message
              : "파일럿 사용자 조회에 실패했습니다.",
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [appliedParticipantSearch, participantCursor, participantStatus]);

  return (
    <>
      <PageHeader
        title="파일럿 관리"
        description="파일럿 대상자를 초대하고 실제 제품 접근 권한을 관리합니다."
      />
      <Panel>
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "invite", label: "대상 추가" },
            {
              value: "invitations",
              label: "초대 현황",
              count: invitations?.items.length,
            },
            {
              value: "participants",
              label: "사용 중",
              count: participants?.items.length,
            },
          ]}
        >
          {tab === "invite" && (
            <form
              className="pilot-invite-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setIsCreating(true);
                setCreateMessage("");
                try {
                  await createPilotInvitation(email, Number(expiresInHours));
                  setEmail("");
                  setCreateMessage(
                    "파일럿 초대 메일을 보냈습니다. 초대 현황에서 상태를 확인할 수 있습니다.",
                  );
                  setInvitationCursor(undefined);
                  setInvitationHistory([]);
                  await loadInvitations();
                } catch (cause) {
                  setCreateMessage(
                    cause instanceof Error
                      ? cause.message
                      : "초대 생성에 실패했습니다.",
                  );
                } finally {
                  setIsCreating(false);
                }
              }}
            >
              <div className="pilot-invite-layout">
                <section className="pilot-invite-guide">
                  <Badge tone="info">INVITE ONLY</Badge>
                  <h2>초대할 사용자를 등록하세요</h2>
                  <p>
                    가입 링크를 받은 사용자는 초대를 수락한 뒤에만 Lynx에 접근할
                    수 있습니다.
                  </p>
                  <ol>
                    <li>
                      <strong>초대 전송</strong>
                      <span>등록한 이메일로 일회성 가입 링크를 보냅니다.</span>
                    </li>
                    <li>
                      <strong>가입과 권한 부여</strong>
                      <span>초대 수락 시 파일럿 접근 권한이 활성화됩니다.</span>
                    </li>
                    <li>
                      <strong>접근 관리</strong>
                      <span>
                        사용 중 탭에서 언제든 접근을 중지할 수 있습니다.
                      </span>
                    </li>
                  </ol>
                </section>
                <div className="pilot-invite-fields">
                  <header>
                    <h3>대상 정보</h3>
                    <p>초대 링크를 받을 이메일과 유효기간을 입력합니다.</p>
                  </header>
                  <label className="field">
                    <span>이메일</span>
                    <input
                      type="email"
                      required
                      placeholder="pilot@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <small>
                      실제 파일럿 참여자가 사용하는 이메일이어야 합니다.
                    </small>
                  </label>
                  <label className="field">
                    <span>초대 유효 시간</span>
                    <select
                      value={expiresInHours}
                      onChange={(event) =>
                        setExpiresInHours(event.target.value)
                      }
                    >
                      <option value="24">24시간</option>
                      <option value="72">3일</option>
                      <option value="168">7일</option>
                      <option value="720">30일</option>
                    </select>
                    <small>
                      만료된 링크는 사용할 수 없으며 다시 초대해야 합니다.
                    </small>
                  </label>
                  {createMessage && (
                    <p
                      className={
                        createMessage.includes("보냈습니다")
                          ? "form-success"
                          : "form-error"
                      }
                    >
                      {createMessage}
                    </p>
                  )}
                  <footer>
                    <button
                      className="button button-primary"
                      disabled={isCreating || email.trim().length === 0}
                    >
                      {isCreating ? "초대 전송 중…" : "파일럿 초대 보내기"}
                    </button>
                  </footer>
                </div>
              </div>
            </form>
          )}

          {tab === "invitations" && (
            <>
              <div className="compact-filter">
                <label className="field">
                  <span>초대 상태</span>
                  <select
                    value={invitationStatus}
                    onChange={(event) => {
                      setInvitationStatus(event.target.value);
                      setInvitationCursor(undefined);
                      setInvitationHistory([]);
                    }}
                  >
                    <option value="">전체 상태</option>
                    <option value="PENDING">수락 대기</option>
                    <option value="ACCEPTED">수락 완료</option>
                    <option value="EXPIRED">만료</option>
                    <option value="REVOKED">취소</option>
                  </select>
                </label>
              </div>
              {!invitations && !invitationError && <LoadingState />}
              {!invitations && invitationError && (
                <ErrorState
                  message={invitationError}
                  onRetry={loadInvitations}
                />
              )}
              {invitations && invitationError && (
                <p className="form-error">{invitationError}</p>
              )}
              {invitations?.items.length === 0 && (
                <EmptyState
                  title="표시할 초대가 없습니다."
                  description="새 대상자를 초대하거나 상태 필터를 변경해 보세요."
                />
              )}
              {invitations && invitations.items.length > 0 && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>이메일</th>
                        <th>상태</th>
                        <th>생성일</th>
                        <th>만료일</th>
                        <th>수락일</th>
                        <th aria-label="작업" />
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.items.map((invitation) => (
                        <tr key={invitation.id}>
                          <td>
                            <div className="cell-primary">
                              {invitation.email}
                            </div>
                            <code className="cell-code">{invitation.id}</code>
                          </td>
                          <td>
                            <Badge tone={getInvitationTone(invitation.status)}>
                              {getInvitationStatusLabel(invitation.status)}
                            </Badge>
                          </td>
                          <td>{formatDate(invitation.createdAt)}</td>
                          <td>{formatDate(invitation.expiresAt)}</td>
                          <td>
                            {invitation.acceptedAt
                              ? formatDate(invitation.acceptedAt)
                              : "—"}
                          </td>
                          <td>
                            {invitation.status === "PENDING" && (
                              <button
                                className="text-link"
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      `${invitation.email} 초대를 취소할까요?`,
                                    )
                                  ) {
                                    return;
                                  }
                                  try {
                                    await revokePilotInvitation(invitation.id);
                                    await loadInvitations();
                                  } catch (cause) {
                                    setInvitationError(
                                      cause instanceof Error
                                        ? cause.message
                                        : "초대 취소에 실패했습니다.",
                                    );
                                  }
                                }}
                              >
                                초대 취소
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {invitations && (
                <Pagination
                  history={invitationHistory}
                  cursor={invitationCursor}
                  nextCursor={invitations.nextCursor}
                  onHistoryChange={setInvitationHistory}
                  onCursorChange={setInvitationCursor}
                />
              )}
            </>
          )}

          {tab === "participants" && (
            <>
              <form
                className="compact-filter"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAppliedParticipantSearch(participantSearch);
                  setParticipantCursor(undefined);
                  setParticipantHistory([]);
                }}
              >
                <label className="field field-grow">
                  <span>사용자 검색</span>
                  <input
                    placeholder="이름 또는 이메일"
                    value={participantSearch}
                    onChange={(event) =>
                      setParticipantSearch(event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>접근 상태</span>
                  <select
                    value={participantStatus}
                    onChange={(event) => {
                      setParticipantStatus(event.target.value);
                      setParticipantCursor(undefined);
                      setParticipantHistory([]);
                    }}
                  >
                    <option value="">전체 상태</option>
                    <option value="ACTIVE">사용 중</option>
                    <option value="SUSPENDED">중지됨</option>
                    <option value="EXPIRED">만료됨</option>
                  </select>
                </label>
                <button className="button button-primary">검색</button>
              </form>
              {!participants && !participantError && <LoadingState />}
              {!participants && participantError && (
                <ErrorState
                  message={participantError}
                  onRetry={loadParticipants}
                />
              )}
              {participants && participantError && (
                <p className="form-error">{participantError}</p>
              )}
              {participants?.items.length === 0 && (
                <EmptyState
                  title="파일럿 사용자가 없습니다."
                  description="초대를 수락한 사용자가 이곳에 표시됩니다."
                />
              )}
              {participants && participants.items.length > 0 && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>사용자</th>
                        <th>접근 상태</th>
                        <th>권한 부여일</th>
                        <th>만료일</th>
                        <th>최근 변경</th>
                        <th aria-label="작업" />
                      </tr>
                    </thead>
                    <tbody>
                      {participants.items.map((participant) => (
                        <tr key={participant.id}>
                          <td>
                            <div className="cell-primary">
                              {participant.user.name}
                            </div>
                            <div className="cell-secondary">
                              {participant.user.email}
                            </div>
                          </td>
                          <td>
                            <Badge
                              tone={getParticipantTone(participant.status)}
                            >
                              {getParticipantStatusLabel(participant.status)}
                            </Badge>
                          </td>
                          <td>{formatDate(participant.grantedAt)}</td>
                          <td>
                            {participant.expiresAt
                              ? formatDate(participant.expiresAt)
                              : "제한 없음"}
                          </td>
                          <td>{formatDate(participant.updatedAt)}</td>
                          <td>
                            <button
                              className="text-link"
                              disabled={changingId === participant.id}
                              onClick={async () => {
                                const nextStatus =
                                  participant.status === "ACTIVE"
                                    ? "SUSPENDED"
                                    : "ACTIVE";
                                setChangingId(participant.id);
                                try {
                                  await updatePilotParticipant(
                                    participant.id,
                                    nextStatus,
                                  );
                                  await loadParticipants();
                                } catch (cause) {
                                  setParticipantError(
                                    cause instanceof Error
                                      ? cause.message
                                      : "접근 상태 변경에 실패했습니다.",
                                  );
                                } finally {
                                  setChangingId("");
                                }
                              }}
                            >
                              {changingId === participant.id
                                ? "변경 중…"
                                : participant.status === "ACTIVE"
                                  ? "사용 중지"
                                  : "다시 활성화"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {participants && (
                <Pagination
                  history={participantHistory}
                  cursor={participantCursor}
                  nextCursor={participants.nextCursor}
                  onHistoryChange={setParticipantHistory}
                  onCursorChange={setParticipantCursor}
                />
              )}
            </>
          )}
        </Tabs>
      </Panel>
    </>
  );
}

function Pagination({
  history,
  cursor,
  nextCursor,
  onHistoryChange,
  onCursorChange,
}: {
  history: Array<string | undefined>;
  cursor: string | undefined;
  nextCursor: string | null;
  onHistoryChange: (history: Array<string | undefined>) => void;
  onCursorChange: (cursor: string | undefined) => void;
}) {
  return (
    <div className="pagination">
      <button
        className="button button-secondary"
        disabled={history.length === 0}
        onClick={() => {
          const previous = [...history];
          const target = previous.pop();
          onHistoryChange(previous);
          onCursorChange(target);
        }}
      >
        이전
      </button>
      <span>페이지 {history.length + 1}</span>
      <button
        className="button button-secondary"
        disabled={!nextCursor}
        onClick={() => {
          onHistoryChange([...history, cursor]);
          onCursorChange(nextCursor ?? undefined);
        }}
      >
        다음
      </button>
    </div>
  );
}

function getInvitationStatusLabel(status: AccessInvitationStatus): string {
  return {
    PENDING: "수락 대기",
    ACCEPTED: "수락 완료",
    EXPIRED: "만료",
    REVOKED: "취소",
  }[status];
}

function getInvitationTone(
  status: AccessInvitationStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACCEPTED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REVOKED") return "danger";
  return "neutral";
}

function getParticipantStatusLabel(status: PilotParticipantStatus): string {
  return {
    ACTIVE: "사용 중",
    SUSPENDED: "중지됨",
    EXPIRED: "만료됨",
  }[status];
}

function getParticipantTone(
  status: PilotParticipantStatus,
): "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "danger";
  return "warning";
}
