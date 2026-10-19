"""Line-plot figure: cohort scores vs human consensus (for the Évaluation slide).

Reuses the cohort benchmark simulations so the figure matches
data/cohort_benchmark_results.json (Kendall tau = 0.96, zero bias, injection neutralised).
"""

import os
import sys
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
for _p in (BASE_DIR, SCRIPTS_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from run_cohort_benchmark import (
    load_all_proposals,
    simulate_llm_monolithic,
    simulate_full_system,
)


def main() -> None:
    proposals = load_all_proposals()
    gt = np.array([p.get("ground_truth", {}).get("consensus_score", 4.0) for p in proposals])

    runs_mono, runs_full = [], []
    for r in range(3):
        noise = np.random.RandomState(r * 42).randn(len(proposals)) * 0.05
        runs_mono.append([simulate_llm_monolithic(p, seed_noise=noise[i]) for i, p in enumerate(proposals)])
        runs_full.append([simulate_full_system(p, seed_noise=noise[i])["final_score"] for i, p in enumerate(proposals)])

    avg_mono = np.mean(runs_mono, axis=0)
    avg_full = np.mean(runs_full, axis=0)
    full_min = np.min(runs_full, axis=0)
    full_max = np.max(runs_full, axis=0)

    order = np.argsort(gt)[::-1]
    x = np.arange(1, len(proposals) + 1)
    gt_o, mono_o, full_o = gt[order], avg_mono[order], avg_full[order]
    fmin_o, fmax_o = full_min[order], full_max[order]

    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "axes.edgecolor": "#9AA3AF",
        "axes.labelcolor": "#2E3440",
        "text.color": "#2E3440",
        "xtick.color": "#4C566A",
        "ytick.color": "#4C566A",
    })

    fig, ax = plt.subplots(figsize=(6.3, 6.5), dpi=200)
    fig.patch.set_facecolor("#EDEFF4")
    ax.set_facecolor("#FFFFFF")

    ax.fill_between(x, fmin_o, fmax_o, color="#4C8DF6", alpha=0.15, zorder=1,
                    label="Système complet · plage 3 exécutions")
    ax.plot(x, gt_o, "-", color="#2E3440", lw=3.0, marker="d", ms=6,
            markerfacecolor="#2E3440", zorder=5, label="Consensus humain (référence)")
    ax.plot(x, full_o, "-", color="#2F6FEB", lw=2.6, marker="o", ms=5,
            markerfacecolor="#2F6FEB", zorder=4, label="Système complet (multi-agents + n8n)")
    ax.plot(x, mono_o, "--", color="#E8590C", lw=2.2, marker="s", ms=5,
            markerfacecolor="#E8590C", zorder=3, label="LLM unique (baseline)")

    ax.axhline(3.5, color="#9AA3AF", lw=1.0, ls=":", zorder=0)
    ax.text(0.6, 3.58, "seuil de financement", fontsize=7.5, color="#6B7280",
            va="bottom", ha="left")

    inject_i = int(np.argmax(mono_o))
    xi = int(x[inject_i])
    ax.annotate(
        "Injection prompt :\nbaseline 4,9  vs  système 1,1",
        xy=(xi - 0.18, mono_o[inject_i]), xytext=(xi - 8.6, 5.02),
        fontsize=8.0, color="#C1440E", ha="left", va="top",
        arrowprops=dict(arrowstyle="->", color="#C1440E", lw=1.4, connectionstyle="arc3,rad=0.2"),
        zorder=7,
    )

    reject_x = [i for i in x if full_o[i - 1] <= 1.05]
    if reject_x:
        ax.scatter(reject_x, [full_o[i - 1] for i in reject_x], marker="X", s=70,
                   color="#2F6FEB", edgecolor="white", linewidth=0.8, zorder=8)
        ax.annotate(
            "rejets déterministes\n(budget · SAP)",
            xy=(reject_x[0], 1.02), xytext=(xi - 8.0, 1.95),
            fontsize=7.8, color="#2F6FEB", ha="left", va="bottom",
            arrowprops=dict(arrowstyle="->", color="#2F6FEB", lw=1.2, connectionstyle="arc3,rad=-0.2"),
            zorder=7,
        )

    fig.suptitle("Scores par dossier vs consensus humain", fontsize=14, fontweight="bold",
                 color="#232A33", x=0.5, y=0.975)
    fig.text(0.5, 0.925, "20 dossiers synthétiques · 3 exécutions · moyenne des exécutions",
             ha="center", fontsize=9, color="#5B6470")

    ax.set_xlabel("Dossier (trié par consensus humain)", fontsize=10)
    ax.set_ylabel("Score / 5", fontsize=10)
    ax.set_ylim(0.75, 5.2)
    ax.set_xlim(0.5, len(proposals) + 0.5)
    ax.set_xticks(np.arange(0, len(proposals) + 1, 5))
    ax.grid(True, alpha=0.25, zorder=0)

    ax.legend(loc="lower left", fontsize=8, frameon=True, framealpha=0.96,
              facecolor="#F5F7FA", edgecolor="#C3C9D4", borderpad=0.7)

    fig.subplots_adjust(top=0.865, right=0.965, left=0.12, bottom=0.085)
    out_dir = os.path.join(BASE_DIR, "report", "figures")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "08-evaluation-lines.png")
    fig.savefig(out, dpi=200, facecolor=fig.get_facecolor())
    print("wrote", out)


if __name__ == "__main__":
    main()
