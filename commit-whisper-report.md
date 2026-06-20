# commit-whisper — commit-whisper

_commit-whisper · 136 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and limited collaboration.

The repository has experienced a burst of activity over a short period, with a high volume of commits and adherence to conventional commit standards. However, the project is heavily reliant on a single contributor, posing a high bus-factor risk. Additionally, the lack of collaboration and branching discipline are areas of concern that need addressing to ensure long-term sustainability and resilience.

- Commit volume is high with 136 commits in June, indicating active development.
- The bus-factor is 1, with 94.85% of contributions from one author, posing a high risk.
- Collaboration is minimal, with no co-authored commits.
- Branching discipline is weak, with 89.71% of commits going directly to the default branch.
- Commit messages are generally high quality, with 82.35% adherence to conventional standards.

## Explanation

The repository has seen a significant amount of activity in a short span, with 136 commits in June alone. This indicates a highly active development phase. The commit frequency shows a median interval of 718 seconds, suggesting bursts of activity, particularly on certain days like June 15 and 18, which saw 32 commits each.

Despite the high activity, the project is at risk due to a bus-factor of 1. This means that nearly all contributions (94.85%) come from a single contributor, which is a critical vulnerability if that contributor becomes unavailable.

Collaboration within the team is minimal, as evidenced by the absence of co-authored commits. This lack of collaboration breadth is reflected in a low hygiene score of 5.15 for this component.

Branching discipline is another area of concern. With 89.71% of commits going directly to the default branch, the project lacks a structured branching strategy, which can complicate future development and integration efforts.

On a positive note, the commit messages are well-structured, with 82.35% adhering to conventional commit standards, and a high message quality score of 91.18. This indicates good communication practices in documenting changes.

## Coaching

The repository is currently in a phase of intense development but faces significant risks due to knowledge concentration and limited collaboration. This improvement plan addresses these issues to enhance sustainability and resilience.

### 1. Knowledge Distribution

- Encourage knowledge sharing by involving more contributors in key areas. This can be done through pair programming or code reviews to distribute understanding across the team.
- Document critical areas of the codebase thoroughly to mitigate the risk associated with the current bus-factor of 1.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging team members to work together on features or fixes. This can be facilitated by setting up regular pair programming sessions.
- Implement a code review process to ensure multiple contributors are familiar with different parts of the codebase.

### 3. Branching Discipline

- Adopt a branching strategy such as Git Flow or GitHub Flow to improve branching discipline. This will help manage features and releases more effectively.
- Reduce direct commits to the default branch by requiring pull requests for all changes. This will encourage better integration practices and code review.

_The top priorities are to address the bus-factor risk by distributing knowledge and to improve collaboration through co-authorship and code reviews. Additionally, adopting a structured branching strategy will enhance the project's resilience and manageability._

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
2026-06-20  ██░░░░░░░░░░  4
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
| 2026-06-20 | 4 |

- **What it means** — The commit volume shows a significant increase over the analyzed period, with a peak in the third week of June. This suggests a period of intense development activity.
- **Strengths**
  - High commit volume indicates active development.
- **Needs improvement** — —
- **Suggestions**
  - Maintain consistent commit activity to avoid burnout and ensure steady progress.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9275.45
medianIntervalSeconds   █░░░░░░░░░░░  718
intervalCount           ░░░░░░░░░░░░  135
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9275.45 |
| medianIntervalSeconds | 718 |
| intervalCount | 135 |

- **What it means** — The average commit interval is approximately 2.5 hours, with a median of about 12 minutes, indicating frequent commits. This suggests a healthy, iterative development process.
- **Strengths**
  - Frequent commits suggest active and ongoing development.
- **Needs improvement** — —
- **Suggestions**
  - Continue maintaining frequent commits to ensure regular progress and quick feedback loops.

#### Active vs. dormant periods  ● ok

```
activePeriods   ████████████  1
dormantPeriods  ░░░░░░░░░░░░  0
```

- **Value** — 14
- **What it means** — There are no dormant periods within the analyzed timeframe, indicating continuous activity throughout the project's lifespan.
- **Strengths**
  - Continuous activity with no dormant periods.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that the team is not overworking by monitoring for signs of burnout.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████████  14.49
ageDays       ████████████  14.49
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 14.49 |
| ageDays | 14.49 |

- **What it means** — The project is 14 days old, indicating it is in its early stages. This is a critical period for establishing development practices and project direction.
- **Strengths**
  - Active development from the start.
- **Needs improvement** — —
- **Suggestions**
  - Focus on setting up robust development practices and clear project goals.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  139.5
p90          ███░░░░░░░░░  1217.5
max          ████████████  4428
mean         █░░░░░░░░░░░  491.6
commitCount  ░░░░░░░░░░░░  136
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 139.5 |
| p90 | 1217.5 |
| max | 4428 |
| mean | 491.6 |
| commitCount | 136 |

- **What it means** — The commit size distribution shows a wide range, with a median size of 139.5 lines and a maximum of 4428 lines. This suggests variability in commit sizes, which can be typical in early project stages.
- **Strengths**
  - Variety in commit sizes can indicate flexibility in development.
- **Needs improvement**
  - Large commits can be harder to review and integrate.
- **Suggestions**
  - Encourage smaller, more frequent commits to improve code review and integration processes.

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
24  ██░░░░░░░░░░  6
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
    - 24: 6
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 24

- **What it means** — Most commits occur between 19:00 and 21:00 UTC, with a peak on Thursdays. This pattern may reflect team preferences or time zone differences.
- **Strengths**
  - Consistent peak activity times suggest a regular working schedule.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that the working schedule aligns with team productivity and well-being. Consider if time zone differences are affecting collaboration.

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

- **What it means** — The repository has a total of 2 contributors, both of whom are active within the last 90 days. This indicates a small but engaged team.
- **Strengths**
  - Active contributors indicate ongoing development.
- **Needs improvement**
  - The contributor count is low, which may impact the diversity of ideas and workload distribution.
- **Suggestions**
  - Consider recruiting more contributors to diversify input and distribute workload more evenly.

#### Contribution distribution  ▲ risk  **94.85/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.85 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.85% of commits and 99.36% of lines. This indicates a potential risk of over-reliance on a single contributor.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one person can lead to bottlenecks and risks if that person becomes unavailable.
- **Suggestions**
  - Encourage more balanced contributions by involving other team members in key areas of the codebase.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.85 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. This is a risk for project continuity if that contributor leaves.
- **Strengths** — —
- **Needs improvement**
  - A bus factor of 1 is a significant risk for project sustainability.
- **Suggestions**
  - Increase knowledge sharing and code ownership among team members to improve the bus factor.

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

- **What it means** — All contributors are new within the last 90 days, with no departures. This suggests recent team growth but also a lack of long-term contributors.
- **Strengths**
  - No departures indicate stability in the short term.
- **Needs improvement**
  - The team lacks long-term contributors, which may affect continuity and historical knowledge.
- **Suggestions**
  - Focus on retaining current contributors to build a stable, experienced team over time.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              █████████░░░  108
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/retrieve                   ████░░░░░░░░  45
src/render/html                ███░░░░░░░░░  42
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
      - touchCount: 108
      - authorCount: 2
      - topAuthorSharePct: 88.89
    - src/narrate
      - touchCount: 61
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/config
      - touchCount: 53
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/retrieve
      - touchCount: 45
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/render/html
      - touchCount: 42
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
    - commit-whisper-report.html
      - touchCount: 9
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/config/env.test.ts
      - touchCount: 8
      - authorCount: 1
      - topAuthorSharePct: 100
    - commit-whisper-report.md
      - touchCount: 7
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
    - src/assemble/report.test.ts
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating a lack of shared ownership.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in many areas can lead to silos and reduce collaborative development.
- **Suggestions**
  - Promote pair programming and code reviews to increase shared ownership and knowledge distribution.

#### Co-authorship / collaboration signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 0 |
| coAuthoredSharePct | 0 |
| totalCoAuthorTrailers | 0 |
| distinctCoAuthors | 0 |

- **What it means** — There are no commits with co-authors, indicating a lack of collaborative coding practices such as pair programming or joint commits.
- **Strengths** — —
- **Needs improvement**
  - Lack of co-authorship suggests limited collaboration, which can hinder team synergy and learning.
- **Suggestions**
  - Encourage practices like pair programming and code reviews to foster collaboration and knowledge sharing.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **50.74/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 50.74 |
| commitCount | 136 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a median length of 64 characters and no empty messages. Half of the commits include a body, suggesting detailed documentation for significant changes.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
- **Needs improvement**
  - Increase the percentage of commits with detailed bodies.
- **Suggestions**
  - Encourage developers to include more detailed descriptions in the commit body, especially for complex changes.

#### Conventional Commits adherence  ● ok  **82.35/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 112 |
| adherenceSharePct | 82.35 |
| subjectsConsidered | 136 |

- **What it means** — The adherence to Conventional Commits is high at 82.35%, indicating that most commit messages follow a standardized format, which helps in maintaining clarity and consistency across the project.
- **Strengths**
  - High adherence to Conventional Commits, enhancing clarity and consistency.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Conduct a workshop or provide guidelines on the importance and structure of Conventional Commits to improve adherence.

#### Imperative-mood / style signal  ● ok  **97.79/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 136 |
| imperativeMoodSharePct | 97.79 |
| capitalizedSubjectSharePct | 23.53 |
| noTrailingPeriodSharePct | 99.26 |

- **What it means** — The imperative mood is used in 97.79% of commit messages, which is a best practice for clarity and actionability. However, only 23.53% of subjects are capitalized, which could be improved for consistency.
- **Strengths**
  - High use of imperative mood, which is a best practice.
- **Needs improvement**
  - Increase the percentage of capitalized subjects for consistency.
- **Suggestions**
  - Encourage capitalization of the first word in commit messages to align with best practices.

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 136 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information, which is excellent for understanding the project's history.
- **Strengths**
  - All commit messages are informative with no low-information entries.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.15/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.15 |
| commitCount | 136 |

- **What it means** — Only 5.15% of commits reference an issue or ticket, which suggests that there might be a lack of traceability between commits and project management tools.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue or ticket references to improve traceability.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to enhance traceability and context.

#### Revert / fixup / amend signal  ● ok  **0.74/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.74 |
| commitCount | 136 |

- **What it means** — The low revert/fixup signal, with only 0.74% churn of intent, suggests that commits are generally well-considered and stable, with minimal need for corrections or amendments.
- **Strengths**
  - Low rate of reverts and fixups, indicating stable and well-considered commits.
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

#### Branch/merge topology summary  ● ok  **5.15/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 136 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.15 |
| regularCommitCount | 128 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with 136 total commits and 7 merge commits, making up 5.15% of the total. The low number of merge commits suggests that most changes are committed directly to the main branch rather than through feature branches.
- **Strengths**
  - Consistent use of a merge-based workflow.
- **Needs improvement**
  - Low percentage of merge commits indicates limited use of feature branches.
- **Suggestions**
  - Encourage the use of feature branches to increase the number of merge commits, which can improve code review and integration processes.

#### Merge vs. rebase tendency  ● ok  **5.15/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.15 |
| firstParentLinearityPct | 94.85 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a 5.15% merge share and 94.85% first-parent linearity. This suggests a preference for keeping a linear history, possibly through rebasing or direct commits.
- **Strengths**
  - High first-parent linearity indicates a clean and understandable commit history.
- **Needs improvement**
  - The mixed tendency might lead to inconsistencies in workflow practices.
- **Suggestions**
  - Establish clear guidelines on when to use merging versus rebasing to maintain consistency in the workflow.

#### Direct-to-default-branch rate  ▲ risk  **89.71/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 122 |
| directToDefaultSharePct | 89.71 |
| viaMergeCount | 14 |
| mainlineCommitCount | 129 |
| totalCommits | 136 |

- **What it means** — A high percentage (89.71%) of commits are made directly to the default branch, indicating that most changes bypass feature branches and are committed directly.
- **Strengths** — —
- **Needs improvement**
  - High direct-to-default rate can lead to less thorough code reviews and integration testing.
- **Suggestions**
  - Promote the use of pull requests and feature branches to reduce the direct-to-default rate, enhancing code quality and collaboration.

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

- **What it means** — There are no long-lived branches in the repository, with the longest branch lasting only 0.01 days. This suggests that branches are either merged quickly or not used extensively.
- **Strengths**
  - Quick merging of branches indicates efficient integration of changes.
- **Needs improvement**
  - Lack of long-lived branches might suggest insufficient use of feature branches for larger tasks.
- **Suggestions**
  - Consider using feature branches for larger tasks that require more time, ensuring they are still merged regularly to avoid integration issues.

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
  - High variability in changes per merge can lead to complex merges that are harder to review.
- **Suggestions**
  - Encourage smaller, more frequent merges to maintain manageable review sizes and reduce integration complexity.

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

- **What it means** — The 'Most-changed files / directories' metric shows which files and directories have been modified most frequently. High touch counts and churn in files like `package-lock.json` and `src/cli/interactive.ts` suggest these areas are under active development or may have stability issues.
- **Strengths**
  - Active development in key areas like `src/cli` indicates ongoing improvements.
- **Needs improvement**
  - High churn in `package-lock.json` suggests potential dependency management issues.
- **Suggestions**
  - Review dependency management practices to reduce churn in `package-lock.json`.
  - Investigate stability or design issues in `src/cli/interactive.ts` due to high churn.

#### Churn rate over time  ● ok  `▅`

- **Value**
  - perMonth
    - 2026-06: 66857
  - totalChurn: 66857

- **What it means** — The 'Churn rate over time' metric indicates the amount of code added and removed over a period. A total churn of 66,857 lines in June 2026 suggests significant development activity, which could be due to new features or refactoring.
- **Strengths**
  - High development activity indicates progress and potential feature additions.
- **Needs improvement**
  - High churn could indicate instability or frequent changes in requirements.
- **Suggestions**
  - Ensure changes are well-documented to maintain codebase stability.
  - Review change management processes to ensure efficient development cycles.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  56742
totalDeletions  ██░░░░░░░░░░  10115
addDeleteRatio  ░░░░░░░░░░░░  5.61
netLines        ██████████░░  46627
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 56742 |
| totalDeletions | 10115 |
| addDeleteRatio | 5.61 |
| netLines | 46627 |

- **What it means** — The 'Add/delete ratio' of 5.61 indicates that for every line deleted, about 5.61 lines were added. This suggests a net growth in the codebase, which is typical during feature development phases.
- **Strengths**
  - A positive add/delete ratio indicates growth and potential feature expansion.
- **Needs improvement** — —
- **Suggestions**
  - Monitor the ratio to ensure it aligns with project goals and does not lead to unnecessary code bloat.

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

- **What it means** — The 'File survival / age' metric shows a median file age of 1.2 days, indicating frequent updates. This could suggest active development or instability in the codebase.
- **Strengths**
  - Frequent updates can indicate active development and responsiveness to change.
- **Needs improvement**
  - Short file age may indicate instability or frequent requirement changes.
- **Suggestions**
  - Stabilize frequently changing files by reviewing their design and requirements.
  - Ensure changes are necessary and aligned with project goals.

#### Large-change events  ● ok  **13.24/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 18 |
| largeChangeSharePct | 13.24 |

- **What it means** — The 'Large-change events' metric shows 18 events with significant churn, indicating major updates or refactoring efforts. These events can disrupt stability if not managed carefully.
- **Strengths**
  - Large changes can indicate significant progress or necessary refactoring.
- **Needs improvement**
  - Frequent large changes can lead to instability if not well-managed.
- **Suggestions**
  - Plan large changes carefully to minimize disruption.
  - Ensure thorough testing and documentation accompany large changes.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  91.18
Commit Size Discipline  ███████████░  80.11
```

#### Overall hygiene score  ◐ watch  **56.41/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 56.41 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 56.41 indicates a moderate level of codebase health. The score is a weighted average of several components, with Message Quality and Commit Size Discipline being strong contributors. However, low scores in Branching Discipline and Collaboration Breadth significantly lower the overall score.
- **Strengths**
  - High Message Quality with a subScore of 91.18 indicates clear and informative commit messages.
  - Commit Size Discipline is strong with a subScore of 80.11, suggesting well-sized commits.
- **Needs improvement**
  - Branching Discipline is very low at 10.29, indicating potential issues with how branches are managed.
  - Collaboration Breadth is also low at 5.15, suggesting limited involvement from multiple contributors.
- **Suggestions**
  - Improve Branching Discipline by establishing clear branching strategies and guidelines.
  - Enhance Collaboration Breadth by encouraging more team members to contribute to the codebase.

#### Bus-factor risk flag  ▲ risk  **94.85/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.85 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, meaning that a single contributor holds a significant amount of knowledge (94.85% of contributions). This poses a risk to the project's sustainability if that contributor becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - High concentration of knowledge in one contributor increases project risk.
- **Suggestions**
  - Distribute knowledge more evenly by involving more team members in key areas of the codebase.
  - Implement pair programming or code reviews to share knowledge.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  91.18
Commit Size Discipline  ███████████░  80.11
```

- **Value**
  - strengths
    - Message Quality: 91.18
    - Commit Size Discipline: 80.11
  - weaknesses
    - Collaboration Breadth: 5.15
    - Branching Discipline: 10.29

- **What it means** — The hygiene strengths and weaknesses highlight areas of excellence and areas needing improvement. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - Message Quality is a strength with a high subScore of 91.18.
  - Commit Size Discipline is also a strength with a subScore of 80.11.
- **Needs improvement**
  - Collaboration Breadth is a weakness with a subScore of 5.15.
  - Branching Discipline is a weakness with a subScore of 10.29.
- **Suggestions**
  - Focus on improving Collaboration Breadth by fostering a more inclusive contribution environment.
  - Enhance Branching Discipline by adopting best practices for branch management.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:46:12.988Z
