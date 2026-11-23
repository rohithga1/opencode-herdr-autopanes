"""Local extension for testy-cool.herdr-sidebar, not part of Herdr core.

Only explicit Autopanes cross-tab children are regrouped. Pane IDs remain native
click targets. Render copies use the owner's tab for indentation; real tabs and
terminals are never moved. This module is original integration code.
"""
def grouped(panes):
    by_id = {p["pane_id"]: p for p in panes if p.get("agent")}
    parents = {}
    for pane in panes:
        tokens = pane.get("tokens") or {}
        parent = by_id.get(tokens.get("ocap_parent"))
        if (pane.get("agent") and parent and parent["pane_id"] != pane["pane_id"]
                and not (parent.get("tokens") or {}).get("ocap_parent")
                and parent["workspace_id"] == pane["workspace_id"]
                and tokens.get("hs_parent") == parent["pane_id"]
                and tokens.get("ocap_owner") and tokens.get("ocap_session")):
            parents[pane["pane_id"]] = parent["pane_id"]
    # Display-only status from the owning OpenCode client, not synthetic Herdr
    # lifecycle reports (the built-in integration can describe the family root).
    def display(pane):
        value = (pane.get("tokens") or {}).get("ocap_status")
        if value == "failed":
            tokens = dict(pane["tokens"])
            tokens["hs_title"] = "[failed] " + (tokens.get("hs_title") or pane.get("label") or "subagent")
            return dict(pane, agent_status="blocked", tokens=tokens)
        return dict(pane, agent_status=value) if value in {"working", "blocked", "done", "idle"} else pane
    result = []
    # ponytail: small workspace scan; index children by parent if hundreds of
    # panes make the companion refresh expensive.
    for pane in panes:
        if pane["pane_id"] in parents:
            continue
        result.append(display(pane))
        for child in panes:
            if parents.get(child["pane_id"]) == pane["pane_id"]:
                result.append(dict(display(child), tab_id=pane["tab_id"]))
    return result, bool(parents)


def apply_group_view():
    from ipc import call
    from runtime import PLUGIN_ID
    return call("agent.view.set", {
        "source": "plugin:" + PLUGIN_ID, "label": "orchestrators",
        "sort": [{"field": {"token": "hs_autopanes_rank"}, "order": "asc"}],
    })


if __name__ == "__main__":
    def p(id, tab, parent=None, workspace="w1"):
        return dict(pane_id=id, tab_id=tab, workspace_id=workspace, agent="opencode",
                    tokens=dict(ocap_parent=parent, hs_parent=parent, ocap_owner="owner", ocap_session="ses_test") if parent else {})
    source = [p("a", "t1"), p("b", "t2"), p("ac", "t3", "a"), p("bc", "t4", "b"),
              p("foreign", "t5", "a", "w2"), p("orphan", "t6", "missing")]
    rows, enabled = grouped(source)
    assert enabled and [x["pane_id"] for x in rows] == ["a", "ac", "b", "bc", "foreign", "orphan"]
    assert rows[1]["tab_id"] == "t1" and source[2]["tab_id"] == "t3"
    assert grouped([p("a", "t1")])[1] is False
    failed = p("failed", "t9", "a")
    failed["tokens"].update(ocap_status="failed", hs_title="Read docs")
    rendered = grouped([p("a", "t1"), failed])[0][1]
    assert rendered["tokens"]["hs_title"] == "[failed] Read docs"
    assert failed["tokens"]["hs_title"] == "Read docs"
