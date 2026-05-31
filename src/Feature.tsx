import type React from "react";
import { useEffect, useState } from "react";
import {
  ConfettiLayer,
  useConfetti,
  useDirectedEdges,
  useEventLog,
  useFlashOnChange,
  useNamedPeer,
  useRoster,
  useWebShare,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Arrival = { id: string; peerId: string; ts: number; via?: string };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="snow-screen">
        <h1>snowball</h1>
        <p className="snow-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf, myName } = useNamedPeer(config, room);
  const edges = useDirectedEdges(room, "invites");
  const log = useEventLog<Arrival>(room, "arrivals");
  const roster = useRoster(room);
  const ws = useWebShare();
  const { burst } = useConfetti();
  const flash = useFlashOnChange(edges.edges.length);
  const [toast, setToast] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (log.size > seen) {
      if (seen > 0) burst({ origin: "top", count: 60, hueRange: [180, 220] });
      setSeen(log.size);
    }
  }, [log.size, seen, burst]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = /inviter=([^&]+)/.exec(window.location.hash);
    const inviter = m?.[1];
    if (!inviter || inviter === room.peerId || edges.has(inviter, room.peerId)) return;
    edges.add(inviter, room.peerId, "invited");
    log.push({ id: rid(), peerId: room.peerId, ts: Date.now(), via: inviter });
  }, [room.peerId, edges, log]);

  const myInvites = edges.adjacencyOut.get(room.peerId)?.length ?? 0;
  const others = edges.edges.length - myInvites;

  const onShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#inviter=${room.peerId}`;
    const result = await ws.share({ title: `${config.appName} room`, url });
    if (result !== "error") {
      setToast(result === "copied" ? "link copied" : "shared!");
      setTimeout(() => setToast(null), 1800);
    }
  };

  const testInvite = (target: string) => {
    if (target === room.peerId || edges.has(room.peerId, target)) return;
    edges.add(room.peerId, target, "invited");
    log.push({ id: rid(), peerId: target, ts: Date.now(), via: room.peerId });
  };

  const peers = Array.from(new Set([...roster.present, ...roster.absent])).filter(
    (p) => p !== room.peerId,
  );

  const roots = Array.from(
    new Set(
      [...edges.adjacencyOut.keys(), ...edges.adjacencyIn.keys()].filter(
        (p) => !edges.adjacencyIn.has(p),
      ),
    ),
  );
  const node = (peerId: string, prev: Set<string>): React.ReactElement | null => {
    if (prev.has(peerId)) return null;
    const next = new Set(prev).add(peerId);
    const kids = (edges.adjacencyOut.get(peerId) ?? []).map((e) => e.to);
    return (
      <li key={peerId} className="snow-node">
        <span className="snow-name">{nameOf(peerId) ?? `peer-${peerId.slice(0, 6)}`}</span>
        {kids.length > 0 && <ul className="snow-children">{kids.map((c) => node(c, next))}</ul>}
      </li>
    );
  };

  return (
    <div className="snow-screen" data-peer-id={room.peerId}>
      <ConfettiLayer />
      <header className="snow-header">
        <h1>snowball</h1>
        <p className="snow-status" style={{ opacity: flash ? 1 : 0.7 }}>
          {edges.edges.length} invites · {roster.present.length} present
        </p>
      </header>
      <input
        className="snow-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={48}
        aria-label="your name"
      />
      <button type="button" className="snow-share" aria-label="share the room" onClick={onShare}>
        share the room
      </button>
      {toast && <p className="snow-toast">{toast}</p>}
      <div className="snow-chip">
        your invites: {myInvites} · their invites: {others}
      </div>
      <div className="snow-graph" aria-label="invite tree">
        {roots.length === 0 ? (
          <p className="snow-empty">no invites yet — share the room to start the snowball</p>
        ) : (
          <ul>{roots.map((r) => node(r, new Set()))}</ul>
        )}
      </div>
      <ul className="snow-arrivals" aria-label="recent arrivals">
        {log.latest(6).map((a) => (
          <li key={a.id}>
            {nameOf(a.peerId) ?? `peer-${a.peerId.slice(0, 6)}`}
            {a.via && <> via {nameOf(a.via) ?? `peer-${a.via.slice(0, 6)}`}</>}
          </li>
        ))}
      </ul>
      <div className="snow-test-row" aria-label="test invites">
        <span className="snow-me">you: {myName}</span>
        {peers.map((p) => {
          const n = nameOf(p) ?? `peer-${p.slice(0, 6)}`;
          return (
            <button
              key={p}
              type="button"
              className="snow-test-invite"
              data-target={p}
              aria-label={`test-invite ${n}`}
              onClick={() => testInvite(p)}
            >
              invite {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function rid(): string {
  return Math.random().toString(36).slice(2, 12);
}
