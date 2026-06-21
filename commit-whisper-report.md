# commit-whisper — commit-whisper

_commit-whisper · 139 commits · 2 contributors · analyzed 2026-06-21_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and collaboration issues.

The repository has experienced a burst of activity over a short period, with a high volume of commits and adherence to conventional commit standards. However, the project is heavily reliant on a single contributor, posing a high bus-factor risk. Additionally, the lack of collaboration and branching discipline are notable weaknesses that need addressing to ensure long-term sustainability and team resilience.

- Commit volume is high with 139 commits in June, indicating active development.
- The bus-factor is 1, with 94.96% of contributions from one author, posing a high risk.
- Collaboration is minimal, with no co-authored commits and a low collaboration score of 5.04.
- Branching discipline is weak, with 89.93% of commits going directly to the default branch.
- Commit messages are strong, with 81.29% adherence to conventional standards.

## Explanation

The repository has seen a significant amount of activity in a short span, with 139 commits in June alone. This indicates a highly active development phase. The commit cadence shows frequent updates, with an average interval of approximately 2.5 hours between commits, suggesting a rapid development pace.

Despite the high activity, the project is at risk due to a high concentration of knowledge. The bus-factor is 1, meaning the project heavily relies on a single contributor who is responsible for 94.96% of the commits. This poses a significant risk if this contributor becomes unavailable.

Collaboration within the team is minimal, as evidenced by the absence of co-authored commits. The collaboration breadth score is low at 5.04, indicating that the project could benefit from more team involvement and shared knowledge.

Branching practices are another area of concern. With 89.93% of commits going directly to the default branch, the project lacks branching discipline, which can lead to integration issues and complicate collaborative development.

On a positive note, the commit messages are well-structured, with 81.29% adhering to conventional commit standards. This indicates good communication practices in documenting changes.

## Coaching

The repository is in a phase of rapid development but faces challenges related to knowledge concentration and collaboration. This improvement plan focuses on mitigating these risks and enhancing team resilience.

### 1. Knowledge Distribution

- Encourage knowledge sharing by involving more contributors in key areas, especially those dominated by a single author.
- Implement pair programming or code review practices to distribute knowledge and reduce reliance on a single contributor.
- Document critical processes and code areas to ensure continuity in case of contributor turnover.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging team members to work together on commits, which can be facilitated through pair programming or collaborative tools.
- Organize regular team meetings to discuss ongoing work and share insights, fostering a collaborative environment.
- Introduce a mentorship program where experienced contributors guide newer team members, enhancing skill distribution.

### 3. Branching Discipline

- Adopt a branching strategy such as Git Flow or feature branching to improve code integration and reduce conflicts.
- Encourage the use of pull requests for all changes, ensuring code is reviewed and tested before merging into the main branch.
- Provide training on effective branching strategies to all team members to improve adherence and understanding.

_The top priorities are to reduce the bus-factor risk by distributing knowledge and to enhance collaboration through co-authorship and structured branching practices. Addressing these areas will improve the project's sustainability and resilience._

## Metrics

### A · Activity & Cadence

How the project moves over time.

```
2026-06-06  █░░░░░░░░░░░  3
2026-06-07  ░░░░░░░░░░░░  1
2026-06-11  █░░░░░░░░░░░  2
2026-06-12  █░░░░░░░░░░░  2
2026-06-13  ██████░░░░░░  17
2026-06-14  ██████░░░░░░  17
2026-06-15  ████████████  32
2026-06-16  █░░░░░░░░░░░  2
2026-06-17  █████████░░░  24
2026-06-18  ████████████  32
2026-06-20  ███░░░░░░░░░  7
```

#### Commit volume over time  ● ok  `▁▁▁▁▅▅█▁▆█▂`

- **Value**

| Period | Value |
| --- | --- |
| 2026-06-06 | 3 |
| 2026-06-07 | 1 |
| 2026-06-11 | 2 |
| 2026-06-12 | 2 |
| 2026-06-13 | 17 |
| 2026-06-14 | 17 |
| 2026-06-15 | 32 |
| 2026-06-16 | 2 |
| 2026-06-17 | 24 |
| 2026-06-18 | 32 |
| 2026-06-20 | 7 |

- **What it means** — The commit volume shows a significant increase in activity over the analyzed period, with a peak in the third week of June. This suggests a period of intense development or a push to meet a deadline.
- **Strengths**
  - High activity in the third week indicates strong team engagement.
- **Needs improvement** — —
- **Suggestions**
  - Maintain consistent commit activity to avoid burnout and ensure steady progress.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9076.78
medianIntervalSeconds   █░░░░░░░░░░░  645.5
intervalCount           ░░░░░░░░░░░░  138
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9076.78 |
| medianIntervalSeconds | 645.5 |
| intervalCount | 138 |

- **What it means** — The commit cadence indicates frequent commits with a median interval of about 11 minutes, suggesting a rapid development pace. The average interval is longer due to some larger gaps between commits.
- **Strengths**
  - Frequent commits suggest active development and regular updates.
- **Needs improvement**
  - Consider balancing the pace to avoid potential quality issues from rapid changes.
- **Suggestions**
  - Encourage regular but thoughtful commits to maintain code quality.

#### Active vs. dormant periods  ● ok

```
activePeriods   ████████████  1
dormantPeriods  ░░░░░░░░░░░░  0
```

- **Value** — 14
- **What it means** — There are no dormant periods within the analyzed timeframe, indicating continuous activity. This reflects a highly active development phase.
- **Strengths**
  - Continuous activity with no dormant periods shows strong project momentum.
- **Needs improvement** — —
- **Suggestions**
  - Plan for sustainable activity to prevent team fatigue.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████████  14.5
ageDays       ████████████  14.51
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 14.5 |
| ageDays | 14.51 |

- **What it means** — The project is very young, with a lifespan of just over 14 days. This suggests it is in its initial development phase.
- **Strengths**
  - Rapid development in the early stages of the project.
- **Needs improvement** — —
- **Suggestions**
  - Establish long-term goals and milestones to guide future development.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  151
p90          ███░░░░░░░░░  1193.2
max          ████████████  4428
mean         █░░░░░░░░░░░  501.23
commitCount  ░░░░░░░░░░░░  139
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 151 |
| p90 | 1193.2 |
| max | 4428 |
| mean | 501.23 |
| commitCount | 139 |

- **What it means** — The commit size distribution shows a wide range of commit sizes, with a median of 151 lines and a maximum of 4428 lines. This indicates variability in the scope of changes being committed.
- **Strengths**
  - Diverse commit sizes can reflect flexibility in handling both small fixes and large features.
- **Needs improvement**
  - Large commits can be harder to review and integrate.
- **Suggestions**
  - Encourage breaking down large changes into smaller, more manageable commits.

#### Time-of-day / day-of-week pattern  ● ok

```
1   ░░░░░░░░░░░░  0
2   ░░░░░░░░░░░░  0
3   ░░░░░░░░░░░░  0
4   ░░░░░░░░░░░░  0
5   █░░░░░░░░░░░  2
6   █░░░░░░░░░░░  2
7   █░░░░░░░░░░░  3
8   █░░░░░░░░░░░  3
9   █░░░░░░░░░░░  3
10  █░░░░░░░░░░░  3
11  █░░░░░░░░░░░  4
12  ██░░░░░░░░░░  5
13  █░░░░░░░░░░░  3
14  █░░░░░░░░░░░  4
15  ░░░░░░░░░░░░  1
16  ██░░░░░░░░░░  7
17  ██░░░░░░░░░░  7
18  ████░░░░░░░░  10
19  ███░░░░░░░░░  9
20  ████████████  34
21  ██████████░░  28
22  █░░░░░░░░░░░  2
23  ░░░░░░░░░░░░  0
24  ███░░░░░░░░░  9
```

- **Value**
  - timezone: UTC
  - byHour
    - 1: 0
    - 2: 0
    - 3: 0
    - 4: 0
    - 5: 2
    - 6: 2
    - 7: 3
    - 8: 3
    - 9: 3
    - 10: 3
    - 11: 4
    - 12: 5
    - 13: 3
    - 14: 4
    - 15: 1
    - 16: 7
    - 17: 7
    - 18: 10
    - 19: 9
    - 20: 34
    - 21: 28
    - 22: 2
    - 23: 0
    - 24: 9
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 27

- **What it means** — Most commits occur during typical working hours, with a peak in the late afternoon. This suggests a standard work schedule with some evening activity.
- **Strengths**
  - Commit activity aligns with a typical workday, indicating structured work habits.
- **Needs improvement**
  - Evening peaks might suggest overtime, which could lead to burnout.
- **Suggestions**
  - Monitor evening activity to ensure it is sustainable and not due to excessive workload.

### B · Contribution & Ownership

How the work is distributed across the team.

```
total             ░░░░░░░░░░░░  2
active            ░░░░░░░░░░░░  2
activeWindowDays  ████████████  90
```

#### Contributor count  ● ok

```
total             ░░░░░░░░░░░░  2
active            ░░░░░░░░░░░░  2
activeWindowDays  ████████████  90
```

- **Value**

| Item | Value |
| --- | --- |
| total | 2 |
| active | 2 |
| activeWindowDays | 90 |

- **What it means** — The repository has a total of 2 contributors, both of whom are active within the last 90 days. This indicates a small, but currently engaged team.
- **Strengths**
  - All contributors are active, indicating engagement.
- **Needs improvement**
  - The contributor base is small, which may risk continuity if one leaves.
- **Suggestions**
  - Consider recruiting more contributors to diversify and strengthen the team.

#### Contribution distribution  ▲ risk  **94.96/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.96 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.96% of commits and 99.39% of lines. This indicates a potential risk of over-reliance on a single contributor.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one person.
- **Suggestions**
  - Encourage more balanced contributions by mentoring and involving the second contributor in more tasks.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.96 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on one contributor. If this person becomes unavailable, it could significantly impact the project.
- **Strengths** — —
- **Needs improvement**
  - The bus factor is low, indicating a risk of knowledge concentration.
- **Suggestions**
  - Increase knowledge sharing and documentation to mitigate risks associated with a low bus factor.

#### New vs. departed contributors  ● ok

```
totalContributors     ░░░░░░░░░░░░  2
newContributors       ░░░░░░░░░░░░  2
departedContributors  ░░░░░░░░░░░░  0
onboardWindowDays     ██████░░░░░░  90
departWindowDays      ████████████  180
```

- **Value**

| Item | Value |
| --- | --- |
| totalContributors | 2 |
| newContributors | 2 |
| departedContributors | 0 |
| onboardWindowDays | 90 |
| departWindowDays | 180 |

- **What it means** — Both contributors are new within the last 90 days, with no departures. This suggests recent growth but also highlights the need for retention strategies.
- **Strengths**
  - No contributors have departed, indicating stability.
- **Needs improvement**
  - All contributors are new, which may affect long-term stability.
- **Suggestions**
  - Implement onboarding and retention strategies to ensure long-term engagement.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              █████████░░░  114
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/render/html                ████░░░░░░░░  45
src/retrieve                   ████░░░░░░░░  45
src/analyze                    ███░░░░░░░░░  37
src/license                    ███░░░░░░░░░  35
src/assemble                   ██░░░░░░░░░░  23
```

- **Value**
  - topDirectories
    - src/cli
      - touchCount: 150
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/implementation-artifacts
      - touchCount: 137
      - authorCount: 1
      - topAuthorSharePct: 100
    - .
      - touchCount: 114
      - authorCount: 2
      - topAuthorSharePct: 89.47
    - src/narrate
      - touchCount: 61
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/config
      - touchCount: 53
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/render/html
      - touchCount: 45
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/retrieve
      - touchCount: 45
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/analyze
      - touchCount: 37
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/license
      - touchCount: 35
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/assemble
      - touchCount: 23
      - authorCount: 1
      - topAuthorSharePct: 100
  - topFiles
    - docs/implementation-artifacts/sprint-status.yaml
      - touchCount: 41
      - authorCount: 1
      - topAuthorSharePct: 100
    - package.json
      - touchCount: 29
      - authorCount: 2
      - topAuthorSharePct: 79.31
    - src/cli/interactive.ts
      - touchCount: 28
      - authorCount: 1
      - topAuthorSharePct: 100
    - package-lock.json
      - touchCount: 24
      - authorCount: 2
      - topAuthorSharePct: 75
    - src/cli/cli.ts
      - touchCount: 21
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/cli/interactive.test.ts
      - touchCount: 20
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/cli/cli.test.ts
      - touchCount: 18
      - authorCount: 1
      - topAuthorSharePct: 100
    - .github/workflows/release.yml
      - touchCount: 12
      - authorCount: 2
      - topAuthorSharePct: 91.67
    - commit-whisper-report.html
      - touchCount: 12
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/cli/run.ts
      - touchCount: 12
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/cli/version.ts
      - touchCount: 12
      - authorCount: 1
      - topAuthorSharePct: 100
    - README.md
      - touchCount: 11
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/implementation-artifacts/deferred-work.md
      - touchCount: 11
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/cli/run.test.ts
      - touchCount: 11
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/config/env.ts
      - touchCount: 11
      - authorCount: 1
      - topAuthorSharePct: 100
    - commit-whisper-report.md
      - touchCount: 10
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/config/env.test.ts
      - touchCount: 8
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/render/html/charts.ts
      - touchCount: 8
      - authorCount: 1
      - topAuthorSharePct: 100
    - sonar-project.properties
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/assemble/report-schema.test.ts
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100

- **What it means** — Ownership is highly concentrated, with most directories and files being managed by a single contributor. This can lead to bottlenecks and risks if that contributor is unavailable.
- **Strengths** — —
- **Needs improvement**
  - High ownership concentration in specific areas.
- **Suggestions**
  - Encourage cross-training and code reviews to distribute knowledge across the team.

#### Co-authorship / collaboration signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 0 |
| coAuthoredSharePct | 0 |
| totalCoAuthorTrailers | 0 |
| distinctCoAuthors | 0 |

- **What it means** — There are no co-authored commits, indicating a lack of collaboration in commit activities. This might suggest isolated work practices.
- **Strengths** — —
- **Needs improvement**
  - Lack of co-authorship suggests limited collaboration.
- **Suggestions**
  - Promote pair programming or collaborative projects to enhance teamwork and knowledge sharing.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **51.8/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 51.8 |
| commitCount | 139 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a mean subject length of 65.01 characters and no empty messages. Over half of the commits include a body, suggesting detailed documentation.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
- **Needs improvement** — —
- **Suggestions** — —

#### Conventional Commits adherence  ● ok  **81.29/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 113 |
| adherenceSharePct | 81.29 |
| subjectsConsidered | 139 |

- **What it means** — The adherence to Conventional Commits is high at 81.29%, indicating that most commit messages follow a standardized format, which helps in maintaining clarity and consistency.
- **Strengths**
  - High adherence to Conventional Commits format.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Encourage team members to use tools or hooks that enforce Conventional Commits format.

#### Imperative-mood / style signal  ● ok  **97.84/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 139 |
| imperativeMoodSharePct | 97.84 |
| capitalizedSubjectSharePct | 24.46 |
| noTrailingPeriodSharePct | 99.28 |

- **What it means** — The imperative mood is used in 97.84% of commit messages, which is a best practice for clarity and consistency. Most subjects are not capitalized, which is acceptable but could be standardized.
- **Strengths**
  - High use of imperative mood in commit messages.
- **Needs improvement**
  - Consider standardizing capitalization for consistency.
- **Suggestions**
  - Review style guidelines to decide on capitalization standards.

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 139 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information.
- **Strengths**
  - All commit messages are informative.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.04/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.04 |
| commitCount | 139 |

- **What it means** — Only 5.04% of commits reference issues or tickets, which may suggest a lack of traceability between commits and project management tools.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue or ticket references in commit messages.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to improve traceability.

#### Revert / fixup / amend signal  ● ok  **0.72/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.72 |
| commitCount | 139 |

- **What it means** — The low churn of intent (0.72%) suggests minimal need for reverts or fixups, indicating a stable development process.
- **Strengths**
  - Low rate of reverts and fixups, indicating stable commits.
- **Needs improvement** — —
- **Suggestions** — —

### D · Branching & Merge Structure

How branching and merging are structured.

```
longLivedBranchCount       ░░░░░░░░░░░░  0
thresholdDays              ████████████  30
mergesAnalyzed             ███░░░░░░░░░  7
branchesWithUniqueCommits  ███░░░░░░░░░  7
longestBranchDays          ░░░░░░░░░░░░  0.01
```

#### Branch/merge topology summary  ● ok  **5.04/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 139 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.04 |
| regularCommitCount | 131 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with 139 total commits and 7 merge commits, making up 5.04% of the total. The low number of merge commits suggests that most changes are committed directly to the main branch rather than through feature branches.
- **Strengths**
  - Consistent use of a merge-based workflow.
- **Needs improvement**
  - Low percentage of merge commits indicates limited use of feature branches.
- **Suggestions**
  - Encourage the use of feature branches to increase the number of merge commits, which can improve code review processes and collaboration.

#### Merge vs. rebase tendency  ● ok  **5.04/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.04 |
| firstParentLinearityPct | 94.96 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a 5.04% merge share and 94.96% first-parent linearity. This suggests that while merges are used, there is a strong preference for maintaining a linear history, possibly through rebasing.
- **Strengths**
  - High first-parent linearity indicates a clean and understandable commit history.
- **Needs improvement**
  - The mixed tendency might lead to inconsistencies in workflow practices.
- **Suggestions**
  - Establish clear guidelines on when to use merging versus rebasing to ensure consistency across the team.

#### Direct-to-default-branch rate  ▲ risk  **89.93/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 125 |
| directToDefaultSharePct | 89.93 |
| viaMergeCount | 14 |
| mainlineCommitCount | 132 |
| totalCommits | 139 |

- **What it means** — A high percentage (89.93%) of commits are made directly to the default branch, indicating that most changes bypass feature branches. This can speed up development but may reduce opportunities for code review and testing.
- **Strengths**
  - Efficient workflow with quick integration of changes.
- **Needs improvement**
  - High direct-to-default rate can lead to less thorough code reviews and potential integration issues.
- **Suggestions**
  - Encourage the use of pull requests and feature branches to facilitate better code reviews and testing before merging into the default branch.

#### Long-lived branch signal  ● ok

```
longLivedBranchCount       ░░░░░░░░░░░░  0
thresholdDays              ████████████  30
mergesAnalyzed             ███░░░░░░░░░  7
branchesWithUniqueCommits  ███░░░░░░░░░  7
longestBranchDays          ░░░░░░░░░░░░  0.01
```

- **Value**

| Item | Value |
| --- | --- |
| longLivedBranchCount | 0 |
| thresholdDays | 30 |
| mergesAnalyzed | 7 |
| branchesWithUniqueCommits | 7 |
| longestBranchDays | 0.01 |

- **What it means** — There are no long-lived branches in this repository, with the longest branch lasting only 0.01 days. This suggests that branches are either merged quickly or not used extensively.
- **Strengths**
  - Quick integration of changes, reducing the risk of merge conflicts.
- **Needs improvement**
  - Lack of long-lived branches might indicate underutilization of feature branches for larger tasks.
- **Suggestions**
  - Consider using feature branches for larger tasks that require more time, ensuring they are still merged regularly to avoid conflicts.

#### Average changes per merge  ● ok

```
mergeCount                 ░░░░░░░░░░░░  7
averageIntegratedChanges   ███░░░░░░░░░  60.71
medianIntegratedChanges    █░░░░░░░░░░░  29
maxIntegratedChanges       ████████████  234
mergesWithNoUniqueCommits  ░░░░░░░░░░░░  0
```

- **Value**

| Item | Value |
| --- | --- |
| mergeCount | 7 |
| averageIntegratedChanges | 60.71 |
| medianIntegratedChanges | 29 |
| maxIntegratedChanges | 234 |
| mergesWithNoUniqueCommits | 0 |

- **What it means** — The average number of changes per merge is 60.71, with a median of 29 and a maximum of 234. This indicates variability in the size of changes being merged, with some merges integrating a large number of changes.
- **Strengths**
  - No merges with no unique commits, indicating that all merges contribute meaningful changes.
- **Needs improvement**
  - High variability in changes per merge could lead to complex merges and potential integration issues.
- **Suggestions**
  - Aim for more frequent, smaller merges to reduce complexity and improve integration testing.

### E · Churn & Hotspots

Where change and instability concentrate.

```
totalFilesTouched        ████████████  262
totalDirectoriesTouched  █░░░░░░░░░░░  29
```

#### Most-changed files / directories  ● ok

```
totalFilesTouched        ████████████  262
totalDirectoriesTouched  █░░░░░░░░░░░  29
```

- **Value**

| Item | Value |
| --- | --- |
| totalFilesTouched | 262 |
| totalDirectoriesTouched | 29 |

- **What it means** — The 'Most-changed files / directories' metric shows which files and directories have been modified most frequently. High touch counts and churn in files like 'package-lock.json' and 'src/cli/interactive.ts' suggest these areas are under active development or may have stability issues.
- **Strengths**
  - Active development in 'src/cli' indicates ongoing feature enhancements.
- **Needs improvement**
  - High churn in 'package-lock.json' suggests potential dependency management issues.
- **Suggestions**
  - Review dependency management practices to reduce churn in 'package-lock.json'.
  - Investigate stability or design issues in 'src/cli/interactive.ts' due to high churn.

#### Churn rate over time  ● ok  `▅`

- **Value**
  - perMonth
    - 2026-06: 69671
  - totalChurn: 69671

- **What it means** — The 'Churn rate over time' metric indicates the amount of code added and removed over a period. A total churn of 69,671 lines in June 2026 suggests significant development activity, possibly due to new features or refactoring.
- **Strengths**
  - High development activity indicates a dynamic and evolving codebase.
- **Needs improvement**
  - High churn can indicate instability or frequent changes that may affect code quality.
- **Suggestions**
  - Monitor code quality and stability during high churn periods to ensure maintainability.
  - Consider implementing more rigorous code reviews to manage churn.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  58155
totalDeletions  ██░░░░░░░░░░  11516
addDeleteRatio  ░░░░░░░░░░░░  5.05
netLines        ██████████░░  46639
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 58155 |
| totalDeletions | 11516 |
| addDeleteRatio | 5.05 |
| netLines | 46639 |

- **What it means** — The 'Add/delete ratio' of 5.05 indicates that for every line deleted, about five lines were added. This suggests a net growth in the codebase, which is typical during feature development phases.
- **Strengths**
  - A positive add/delete ratio indicates growth and potential feature expansion.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that the growth aligns with project goals and does not lead to unnecessary complexity.

#### File survival / age  ● ok

```
medianAgeDays         ░░░░░░░░░░░░  1.2
maxAgeDays            ░░░░░░░░░░░░  9.23
filesConsidered       ████████████  262
singleTouchFileCount  ███░░░░░░░░░  63
```

- **Value**

| Item | Value |
| --- | --- |
| medianAgeDays | 1.2 |
| maxAgeDays | 9.23 |
| filesConsidered | 262 |
| singleTouchFileCount | 63 |

- **What it means** — The 'File survival / age' metric shows a median file age of 1.2 days, indicating frequent updates. This suggests active development but may also point to instability if files are frequently rewritten.
- **Strengths**
  - Frequent updates can indicate active development and responsiveness to change.
- **Needs improvement**
  - Frequent rewriting of files may suggest instability or lack of clear design.
- **Suggestions**
  - Evaluate whether frequent changes are due to evolving requirements or design issues.
  - Consider stabilizing frequently changed files to improve maintainability.

#### Large-change events  ● ok  **12.95/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 18 |
| largeChangeSharePct | 12.95 |

- **What it means** — The 'Large-change events' metric identifies 18 events where changes exceeded 1,000 lines, comprising 12.95% of all changes. This indicates significant updates or refactoring efforts.
- **Strengths**
  - Large changes can be indicative of major feature additions or significant refactoring.
- **Needs improvement**
  - Frequent large changes can disrupt team workflows and introduce bugs.
- **Suggestions**
  - Plan large changes carefully to minimize disruption and ensure thorough testing.
  - Break down large changes into smaller, manageable parts where possible.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  90.65
Commit Size Discipline  ██████████░░  77.56
```

#### Overall hygiene score  ◐ watch  **55.57/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 55.57 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 55.57 indicates moderate codebase health. The score is a weighted average of several components, with Message Quality and Commit Size Discipline contributing positively. However, low scores in Branching Discipline and Collaboration Breadth significantly lower the overall score.
- **Strengths**
  - High Message Quality with a subScore of 90.65.
  - Good Commit Size Discipline with a subScore of 77.56.
- **Needs improvement**
  - Branching Discipline with a subScore of 10.07.
  - Collaboration Breadth with a subScore of 5.04.
- **Suggestions**
  - Improve Branching Discipline by establishing clear branching strategies and guidelines.
  - Enhance Collaboration Breadth by encouraging more team members to contribute to the codebase.

#### Bus-factor risk flag  ▲ risk  **94.96/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.96 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, indicating that a single person holds most of the knowledge about the codebase. This poses a significant risk if that person becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - High concentration of knowledge with one contributor holding 94.96% of the contribution share.
- **Suggestions**
  - Distribute knowledge by involving more team members in key areas of the codebase.
  - Conduct regular knowledge-sharing sessions to reduce dependency on a single contributor.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  90.65
Commit Size Discipline  ██████████░░  77.56
```

- **Value**
  - strengths
    - Message Quality: 90.65
    - Commit Size Discipline: 77.56
  - weaknesses
    - Collaboration Breadth: 5.04
    - Branching Discipline: 10.07

- **What it means** — The hygiene strengths and weaknesses highlight areas of excellence and those needing attention. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - Strong Message Quality with a subScore of 90.65.
  - Good Commit Size Discipline with a subScore of 77.56.
- **Needs improvement**
  - Collaboration Breadth with a subScore of 5.04.
  - Branching Discipline with a subScore of 10.07.
- **Suggestions**
  - Focus on improving Collaboration Breadth by fostering a more inclusive contribution environment.
  - Enhance Branching Discipline by implementing better branching practices and training.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-21T00:06:27.402Z
