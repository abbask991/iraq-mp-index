"""MPII dashboard — interactive view of the Iraq MP Impact Index.

Run:  streamlit run app.py     (opens at http://localhost:8501)
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

from mpii.config import Config
from mpii.report import GROUPINGS, aggregate
from mpii.scoring import compute_scores

CONFIGS = {
    "Objective v1 (3 dimensions)": "config.objective.yaml",
    "Full model (5 dimensions)": "config.yaml",
}
GRADE_COLORS = {"A+": "#15803d", "A": "#16a34a", "B": "#65a30d", "C": "#ca8a04", "D": "#ea580c", "F": "#dc2626"}

st.set_page_config(page_title="MPII — Iraq MP Index", page_icon="🏛️", layout="wide")


@st.cache_data
def load_results(config_path: str) -> pd.DataFrame:
    cfg = Config.load(config_path)
    members = pd.read_csv("data/members.csv")
    raw = pd.read_csv("data/raw_indicators.csv")
    return compute_scores(cfg, members, raw).reset_index()


def dim_label(col: str) -> str:
    return col.replace("dim_", "").replace("_", " ").title()


# ---- sidebar ---------------------------------------------------------------
st.sidebar.title("🏛️ MPII")
st.sidebar.caption("Member of Parliament Impact Index — Iraq")
config_name = st.sidebar.radio("Methodology", list(CONFIGS), index=0)
results = load_results(CONFIGS[config_name])
dim_cols = [c for c in results.columns if c.startswith("dim_")]

st.sidebar.markdown("### Filters")
govs = st.sidebar.multiselect("Governorate", sorted(results["governorate"].dropna().unique()))
blocs = st.sidebar.multiselect("Bloc", sorted(results["bloc"].dropna().unique()))
committees = st.sidebar.multiselect("Committee", sorted(results["committee"].dropna().unique()))

view = results.copy()
if govs:
    view = view[view["governorate"].isin(govs)]
if blocs:
    view = view[view["bloc"].isin(blocs)]
if committees:
    view = view[view["committee"].isin(committees)]
view = view.sort_values("mpii", ascending=False)

# ---- header / KPIs ---------------------------------------------------------
st.title("Member of Parliament Impact Index")
st.caption(f"{config_name} · {len(view)} of {len(results)} MPs shown")

k1, k2, k3, k4 = st.columns(4)
k1.metric("MPs shown", len(view))
k2.metric("Average MPII", f"{view['mpii'].mean():.1f}" if len(view) else "—")
k3.metric("Top score", f"{view['mpii'].max():.1f}" if len(view) else "—")
k4.metric("Pass rate (≥60)", f"{(view['mpii'] >= 60).mean() * 100:.0f}%" if len(view) else "—")

tab_rank, tab_groups, tab_profile = st.tabs(["🏆 Ranking", "📊 Group rankings", "👤 MP profile"])

# ---- ranking ---------------------------------------------------------------
with tab_rank:
    st.subheader("Ranked MPs")
    show = view[["rank_overall", "name", "governorate", "bloc", "committee", *dim_cols, "mpii", "grade"]]
    st.dataframe(
        show.rename(columns={"rank_overall": "rank", **{c: dim_label(c) for c in dim_cols}}),
        use_container_width=True,
        hide_index=True,
        column_config={"mpii": st.column_config.ProgressColumn("MPII", min_value=0, max_value=100, format="%.1f")},
    )
    if len(view):
        st.subheader("Top MPs by score")
        st.bar_chart(view.set_index("name")["mpii"].head(15), color="#2563eb", horizontal=True)

# ---- group rankings --------------------------------------------------------
with tab_groups:
    by = st.radio("Group by", GROUPINGS, horizontal=True)
    table = aggregate(view, by)
    st.dataframe(
        table[["rank", by, "members", "mpii_mean", "mpii_min", "mpii_max", "top_mp"]],
        use_container_width=True,
        hide_index=True,
        column_config={"mpii_mean": st.column_config.ProgressColumn("Mean MPII", min_value=0, max_value=100, format="%.1f")},
    )
    st.bar_chart(table.set_index(by)["mpii_mean"], color="#7c3aed", horizontal=True)

# ---- MP profile ------------------------------------------------------------
with tab_profile:
    if not len(view):
        st.info("No MPs match the current filters.")
    else:
        name = st.selectbox("Select MP", view["name"].tolist())
        mp = view[view["name"] == name].iloc[0]

        c1, c2 = st.columns([1, 2])
        with c1:
            grade = mp["grade"]
            st.markdown(
                f"<h1 style='color:{GRADE_COLORS.get(grade, '#333')};margin-bottom:0'>{mp['mpii']:.1f}</h1>"
                f"<h3 style='color:{GRADE_COLORS.get(grade, '#333')};margin-top:0'>Grade {grade}</h3>",
                unsafe_allow_html=True,
            )
            st.write(f"**Governorate:** {mp['governorate']}")
            st.write(f"**Bloc:** {mp['bloc']}")
            st.write(f"**Committee:** {mp['committee']}")
            st.write(f"**Overall rank:** #{int(mp['rank_overall'])} of {len(results)}")
            st.write(f"**Rank in governorate:** #{int(mp['rank_in_governorate'])}")
            st.write(f"**Rank in bloc:** #{int(mp['rank_in_bloc'])}")
        with c2:
            st.markdown("**Dimension breakdown (0–100)**")
            breakdown = pd.DataFrame(
                {"dimension": [dim_label(c) for c in dim_cols], "score": [mp[c] for c in dim_cols]}
            ).set_index("dimension")
            st.bar_chart(breakdown, color="#2563eb", horizontal=True)

st.sidebar.markdown("---")
st.sidebar.caption("Scores are computed live from data/*.csv. Edit the CSVs and refresh.")
