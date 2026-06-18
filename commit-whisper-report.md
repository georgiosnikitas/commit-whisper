# commit-whisper — georgiosnikitas/brain-break

_georgiosnikitas/brain-break · 278 commits · 2 contributors · analyzed 2026-06-18_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows strong commit size discipline but faces challenges with collaboration and branching practices.

The repository has a high concentration of knowledge risk due to a single dominant contributor, and while commit size and message quality are strengths, collaboration and branching practices need improvement. The commit volume has decreased significantly over time, and the project is heavily reliant on one contributor, posing a high bus-factor risk. Addressing these issues will improve the repository's overall health and sustainability.

- Commit volume decreased from 189 in March to 26 in May.
- One contributor is responsible for 99.28% of commits, indicating high bus-factor risk.
- Commit size discipline is excellent with a perfect score of 100.
- Branching discipline is weak with a score of 7.55.
- Collaboration breadth is minimal with a score of 0.72.

## Explanation

The repository's commit volume has significantly decreased from 189 in March to just 26 in May, indicating a potential slowdown in development activity. This could be due to various factors such as project completion phases or resource allocation changes.

The project is heavily reliant on a single contributor, who is responsible for 99.28% of the commits. This creates a high bus-factor risk, meaning the project is vulnerable if this contributor becomes unavailable.

Commit size discipline is a strong point, with a perfect score of 100, indicating that commits are well-sized and likely manageable. Message quality is also high, with a score of 84.89, suggesting that commit messages are informative and well-structured.

However, the repository struggles with collaboration and branching practices. The collaboration breadth score is only 0.72, reflecting minimal co-authorship and shared contributions. Branching discipline is also weak, with a score of 7.55, indicating a high rate of direct commits to the default branch and limited use of feature branches.

## Coaching

The repository is currently facing challenges with collaboration and branching practices, alongside a high concentration of knowledge risk. This improvement plan focuses on enhancing these areas to ensure better sustainability and team resilience.

### 1. Collaboration Enhancement

- Encourage more co-authorship by pairing contributors on tasks to increase the collaboration breadth score from 0.72.
- Implement regular code reviews and pair programming sessions to distribute knowledge more evenly across the team.

### 2. Branching Discipline

- Adopt a more structured branching strategy to improve the branching discipline score from 7.55. Encourage the use of feature branches for new developments and bug fixes.
- Reduce the direct-to-default-branch commit rate from 92.45% by enforcing pull requests and code reviews before merging.

### 3. Knowledge Distribution

- Develop a knowledge transfer plan to mitigate the high bus-factor risk, ensuring that more team members are familiar with critical parts of the codebase.
- Conduct regular knowledge-sharing sessions and document key processes and code areas to reduce reliance on the top contributor.

_The top priorities are to enhance collaboration and improve branching discipline. Start by encouraging co-authorship and adopting a structured branching strategy. Simultaneously, work on distributing knowledge to mitigate the high bus-factor risk._

## Metrics

### A · Activity & Cadence

How the project moves over time.

```
2026-03-01  █░░░░░░░░░░░  3
2026-03-07  ██████░░░░░░  14
2026-03-12  ████████░░░░  20
2026-03-14  ████████████  29
2026-03-15  ███████░░░░░  17
2026-03-17  █░░░░░░░░░░░  3
2026-03-21  ████████░░░░  20
2026-03-22  ███░░░░░░░░░  7
2026-03-23  ░░░░░░░░░░░░  1
2026-03-24  ███░░░░░░░░░  8
2026-03-25  ███████░░░░░  17
2026-03-26  ████░░░░░░░░  10
2026-03-27  ██░░░░░░░░░░  6
2026-03-28  ████░░░░░░░░  10
2026-03-29  █████░░░░░░░  12
2026-03-30  █████░░░░░░░  11
2026-03-31  ░░░░░░░░░░░░  1
2026-04-01  ██░░░░░░░░░░  4
2026-04-03  █░░░░░░░░░░░  3
2026-04-04  ███████░░░░░  16
2026-04-05  ███████████░  26
2026-04-07  █░░░░░░░░░░░  2
2026-04-20  ██░░░░░░░░░░  5
2026-04-21  █░░░░░░░░░░░  2
2026-04-22  ░░░░░░░░░░░░  1
2026-04-24  ░░░░░░░░░░░░  1
2026-04-25  █░░░░░░░░░░░  3
2026-05-01  ░░░░░░░░░░░░  1
2026-05-09  ██░░░░░░░░░░  6
2026-05-10  █░░░░░░░░░░░  2
2026-05-15  ░░░░░░░░░░░░  1
2026-05-16  █████░░░░░░░  11
2026-05-17  ██░░░░░░░░░░  5
```

#### Commit volume over time  ● ok  `▂▄▆█▅▂▆▃▁▃▅▃▂▃▄▄▁▂▂▅▇▁▂▁▁▁▂▁▂▁▁▄▂`

- **Value**

| Period | Value |
| --- | --- |
| 2026-03-01 | 3 |
| 2026-03-07 | 14 |
| 2026-03-12 | 20 |
| 2026-03-14 | 29 |
| 2026-03-15 | 17 |
| 2026-03-17 | 3 |
| 2026-03-21 | 20 |
| 2026-03-22 | 7 |
| 2026-03-23 | 1 |
| 2026-03-24 | 8 |
| 2026-03-25 | 17 |
| 2026-03-26 | 10 |
| 2026-03-27 | 6 |
| 2026-03-28 | 10 |
| 2026-03-29 | 12 |
| 2026-03-30 | 11 |
| 2026-03-31 | 1 |
| 2026-04-01 | 4 |
| 2026-04-03 | 3 |
| 2026-04-04 | 16 |
| 2026-04-05 | 26 |
| 2026-04-07 | 2 |
| 2026-04-20 | 5 |
| 2026-04-21 | 2 |
| 2026-04-22 | 1 |
| 2026-04-24 | 1 |
| 2026-04-25 | 3 |
| 2026-05-01 | 1 |
| 2026-05-09 | 6 |
| 2026-05-10 | 2 |
| 2026-05-15 | 1 |
| 2026-05-16 | 11 |
| 2026-05-17 | 5 |

- **What it means** — The commit volume shows a high level of activity in March, with a peak of 189 commits, followed by a significant drop in April and May. This indicates a burst of development activity initially, which then tapered off.
- **Strengths**
  - High initial activity suggests strong project kickoff.
- **Needs improvement**
  - Sustainability of commit volume over time.
- **Suggestions**
  - Investigate reasons for the drop in activity after March.
  - Encourage consistent commit practices to maintain momentum.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  23983.58
medianIntervalSeconds   ░░░░░░░░░░░░  677
intervalCount           ░░░░░░░░░░░░  277
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 23983.58 |
| medianIntervalSeconds | 677 |
| intervalCount | 277 |

- **What it means** — The average commit interval is approximately 6.7 hours, with a median of about 11 minutes. This suggests frequent commits, which is generally positive for continuous integration practices.
- **Strengths**
  - Frequent commits indicate active development and integration.
- **Needs improvement** — —
- **Suggestions**
  - Maintain this cadence to support agile development practices.

#### Active vs. dormant periods  ● ok  **14**

- **Value** — 14
- **What it means** — There are no dormant periods, indicating continuous activity from March to May. This is a positive sign of ongoing development without significant breaks.
- **Strengths**
  - Continuous activity without dormancy.
- **Needs improvement** — —
- **Suggestions**
  - Continue to monitor for any potential future dormancy.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████░░░░  76.89
ageDays       ████████████  109.42
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 76.89 |
| ageDays | 109.42 |

- **What it means** — The project is relatively young, with a lifespan of about 77 days. This suggests it is still in its early stages of development.
- **Strengths**
  - Active development in the early stages of the project.
- **Needs improvement** — —
- **Suggestions**
  - Focus on establishing strong development practices as the project matures.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  35.5
p90          ██░░░░░░░░░░  701.9
max          ████████████  3935
mean         █░░░░░░░░░░░  266.8
commitCount  █░░░░░░░░░░░  278
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 35.5 |
| p90 | 701.9 |
| max | 3935 |
| mean | 266.8 |
| commitCount | 278 |

- **What it means** — The commit size distribution shows a wide range, with a median of 35.5 and a maximum of 3935. This indicates variability in commit sizes, which can be typical but may need monitoring to ensure consistency.
- **Strengths** — —
- **Needs improvement**
  - Large variability in commit sizes.
- **Suggestions**
  - Encourage smaller, more consistent commit sizes to improve code review and integration processes.

#### Time-of-day / day-of-week pattern  ● ok

- **Value**
  - timezone: UTC
  - byHour
    - 1: 20
    - 2: 5
    - 3: 3
    - 4: 0
    - 5: 0
    - 6: 1
    - 7: 3
    - 8: 15
    - 9: 9
    - 10: 4
    - 11: 15
    - 12: 14
    - 13: 26
    - 14: 15
    - 15: 6
    - 16: 9
    - 17: 8
    - 18: 23
    - 19: 12
    - 20: 11
    - 21: 13
    - 22: 22
    - 23: 22
    - 24: 22
  - byWeekday
    - 1: 72
    - 2: 17
    - 3: 16
    - 4: 22
    - 5: 30
    - 6: 12
    - 7: 109

- **What it means** — Most commits occur during typical working hours, with a peak on Sundays. This suggests a flexible work schedule or weekend catch-up work.
- **Strengths**
  - Commit activity aligns with typical working hours.
- **Needs improvement**
  - High activity on Sundays may indicate work-life balance issues.
- **Suggestions**
  - Encourage a balanced work schedule to prevent burnout.
  - Consider team discussions to understand weekend work patterns.

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
  - Both contributors are active, indicating consistent engagement.
- **Needs improvement**
  - The contributor count is low, which may risk knowledge concentration and bus factor issues.
- **Suggestions**
  - Consider recruiting more contributors to diversify knowledge and reduce risk.

#### Contribution distribution  ▲ risk  **99.28/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.49 |
| giniLines | 0.5 |
| topCommitSharePct | 99.28 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 99.28% of commits and 99.88% of lines. This suggests a significant imbalance in contributions.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one individual, which can lead to bottlenecks and risks if that person becomes unavailable.
- **Suggestions**
  - Encourage more balanced contributions by involving the second contributor more actively in key areas.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 99.28 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. This is a risk for project continuity if that person leaves or is unavailable.
- **Strengths** — —
- **Needs improvement**
  - The bus factor of 1 indicates a critical dependency on one contributor.
- **Suggestions**
  - Increase the bus factor by distributing knowledge and responsibilities among more contributors.

#### New vs. departed contributors  ● ok

```
totalContributors     ░░░░░░░░░░░░  2
newContributors       ░░░░░░░░░░░░  1
departedContributors  ░░░░░░░░░░░░  0
onboardWindowDays     ██████░░░░░░  90
departWindowDays      ████████████  180
```

- **Value**

| Item | Value |
| --- | --- |
| totalContributors | 2 |
| newContributors | 1 |
| departedContributors | 0 |
| onboardWindowDays | 90 |
| departWindowDays | 180 |

- **What it means** — There is one new contributor and no departures in the last 90 days, suggesting some growth without loss of existing contributors.
- **Strengths**
  - New contributor added without any departures, indicating positive growth.
- **Needs improvement** — —
- **Suggestions**
  - Continue onboarding new contributors to further strengthen the team.

#### Ownership by area  ● ok

- **Value**
  - topDirectories
    - src/screens
      - touchCount: 404
      - authorCount: 1
      - topAuthorSharePct: 100
    - .
      - touchCount: 210
      - authorCount: 2
      - topAuthorSharePct: 99.05
    - docs/planning-artifacts
      - touchCount: 140
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/implementation-artifacts
      - touchCount: 128
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/ai
      - touchCount: 82
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/domain
      - touchCount: 82
      - authorCount: 1
      - topAuthorSharePct: 100
    - src
      - touchCount: 63
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/utils
      - touchCount: 42
      - authorCount: 1
      - topAuthorSharePct: 100
    - .github/workflows
      - touchCount: 27
      - authorCount: 1
      - topAuthorSharePct: 100
    - \_bmad-output/implementation-artifacts
      - touchCount: 23
      - authorCount: 1
      - topAuthorSharePct: 100
  - topFiles
    - package.json
      - touchCount: 90
      - authorCount: 1
      - topAuthorSharePct: 100
    - package-lock.json
      - touchCount: 67
      - authorCount: 2
      - topAuthorSharePct: 97.01
    - README.md
      - touchCount: 43
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/planning-artifacts/epics.md
      - touchCount: 38
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/planning-artifacts/prd.md
      - touchCount: 36
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/settings.ts
      - touchCount: 29
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/implementation-artifacts/sprint-status.yaml
      - touchCount: 26
      - authorCount: 1
      - topAuthorSharePct: 100
    - docs/planning-artifacts/architecture.md
      - touchCount: 26
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/quiz.test.ts
      - touchCount: 25
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/quiz.ts
      - touchCount: 25
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/ai/client.test.ts
      - touchCount: 24
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/home.test.ts
      - touchCount: 24
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/settings.test.ts
      - touchCount: 24
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/router.ts
      - touchCount: 23
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/domain/schema.ts
      - touchCount: 22
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/home.ts
      - touchCount: 22
      - authorCount: 1
      - topAuthorSharePct: 100
    - .github/workflows/release.yml
      - touchCount: 21
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/ai/client.ts
      - touchCount: 19
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/domain/schema.test.ts
      - touchCount: 19
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/screens/history.ts
      - touchCount: 19
      - authorCount: 1
      - topAuthorSharePct: 100

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating a lack of shared ownership.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in most areas, which can lead to knowledge silos.
- **Suggestions**
  - Promote pair programming or code reviews to increase shared ownership across different areas.

#### Co-authorship / collaboration signal  ● ok  **7.91/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 22 |
| coAuthoredSharePct | 7.91 |
| totalCoAuthorTrailers | 22 |
| distinctCoAuthors | 3 |

- **What it means** — The co-authorship metric shows that 7.91% of commits involve co-authors, indicating some level of collaboration, but it could be improved.
- **Strengths**
  - Presence of co-authored commits suggests some collaboration.
- **Needs improvement**
  - Low percentage of co-authored commits, indicating limited collaboration.
- **Suggestions**
  - Encourage more collaborative practices, such as pair programming or team-based projects, to increase co-authorship.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **25.9/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 25.9 |
| commitCount | 278 |

- **What it means** — The message length distribution indicates that commit messages are generally well-formed, with a median length of 53.5 characters and no empty messages. The presence of a body in 25.9% of messages suggests that detailed explanations are sometimes provided.
- **Strengths**
  - No empty commit messages, indicating attention to detail.
- **Needs improvement**
  - Increase the percentage of messages with bodies to provide more context.
- **Suggestions**
  - Encourage developers to include more detailed bodies in commit messages, especially for complex changes.

#### Conventional Commits adherence  ◐ watch  **69.78/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 194 |
| adherenceSharePct | 69.78 |
| subjectsConsidered | 278 |

- **What it means** — The adherence to Conventional Commits is at 69.78%, showing a strong but not complete adoption of the standard. This helps in maintaining a consistent commit history.
- **Strengths**
  - High adherence to Conventional Commits, aiding in clarity and consistency.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Conduct a workshop or provide guidelines on the importance and usage of Conventional Commits to improve adherence.

#### Imperative-mood / style signal  ● ok  **91.01/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 278 |
| imperativeMoodSharePct | 91.01 |
| capitalizedSubjectSharePct | 7.19 |
| noTrailingPeriodSharePct | 100 |

- **What it means** — The imperative mood is used in 91.01% of commit messages, which is a good practice for clarity and consistency. However, only 7.19% of subjects are capitalized, which is less common but not necessarily problematic.
- **Strengths**
  - High use of imperative mood, enhancing clarity.
- **Needs improvement** — —
- **Suggestions** — —

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 278 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information.
- **Strengths**
  - No low-information messages, ensuring all commits are informative.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **2.52/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 2.52 |
| commitCount | 278 |

- **What it means** — Only 2.52% of commits reference issues or tickets, which is quite low. This can make it harder to track changes related to specific issues.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue or ticket references in commit messages.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to improve traceability.

#### Revert / fixup / amend signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 0 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 0 |
| churnOfIntentSharePct | 0 |
| commitCount | 278 |

- **What it means** — There are no revert, fixup, or squash commits, indicating a clean commit history with minimal churn of intent.
- **Strengths**
  - No revert or fixup commits, suggesting a stable and well-managed commit history.
- **Needs improvement** — —
- **Suggestions** — —

### D · Branching & Merge Structure

How branching and merging are structured.

```
longLivedBranchCount       ░░░░░░░░░░░░  0
thresholdDays              ████████████  30
mergesAnalyzed             ████░░░░░░░░  9
branchesWithUniqueCommits  ████░░░░░░░░  9
longestBranchDays          ███░░░░░░░░░  8.68
```

#### Branch/merge topology summary  ● ok  **3.24/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 278 |
| mergeCommitCount | 9 |
| mergeSharePct | 3.24 |
| regularCommitCount | 268 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — The repository primarily uses a merge-based workflow, with 278 total commits and 9 merge commits, resulting in a low merge share of 3.24%. This indicates that most changes are committed directly rather than through merges.
- **Strengths** — —
- **Needs improvement**
  - Low merge commit count suggests limited use of feature branches.
- **Suggestions**
  - Encourage the use of feature branches to increase the number of merge commits, which can improve code review and integration processes.

#### Merge vs. rebase tendency  ● ok  **3.24/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 3.24 |
| firstParentLinearityPct | 95.68 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a high first-parent linearity of 95.68% and a low merge share of 3.24%. This suggests a preference for linear history, possibly through rebasing or direct commits.
- **Strengths**
  - High first-parent linearity indicates a clean and understandable commit history.
- **Needs improvement**
  - Low merge share suggests limited use of collaborative workflows.
- **Suggestions**
  - Consider increasing the use of merges for collaborative features to balance the linear history with collaborative development.

#### Direct-to-default-branch rate  ▲ risk  **92.45/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 257 |
| directToDefaultSharePct | 92.45 |
| viaMergeCount | 21 |
| mainlineCommitCount | 266 |
| totalCommits | 278 |

- **What it means** — A high 92.45% of commits are made directly to the default branch, indicating a strong preference for direct commits over feature branches or pull requests.
- **Strengths** — —
- **Needs improvement**
  - High direct-to-default rate can lead to less code review and testing before integration.
- **Suggestions**
  - Encourage the use of pull requests and feature branches to reduce the direct-to-default rate, enhancing code quality and collaboration.

#### Long-lived branch signal  ● ok

```
longLivedBranchCount       ░░░░░░░░░░░░  0
thresholdDays              ████████████  30
mergesAnalyzed             ████░░░░░░░░  9
branchesWithUniqueCommits  ████░░░░░░░░  9
longestBranchDays          ███░░░░░░░░░  8.68
```

- **Value**

| Item | Value |
| --- | --- |
| longLivedBranchCount | 0 |
| thresholdDays | 30 |
| mergesAnalyzed | 9 |
| branchesWithUniqueCommits | 9 |
| longestBranchDays | 8.68 |

- **What it means** — There are no long-lived branches, with the longest branch lasting only 8.68 days. This suggests efficient merging and integration of changes.
- **Strengths**
  - Quick integration of branches indicates efficient workflow and reduced risk of merge conflicts.
- **Needs improvement** — —
- **Suggestions** — —

#### Average changes per merge  ● ok

```
mergeCount                 ░░░░░░░░░░░░  9
averageIntegratedChanges   ██░░░░░░░░░░  296.56
medianIntegratedChanges    ░░░░░░░░░░░░  66
maxIntegratedChanges       ████████████  1986
mergesWithNoUniqueCommits  ░░░░░░░░░░░░  0
```

- **Value**

| Item | Value |
| --- | --- |
| mergeCount | 9 |
| averageIntegratedChanges | 296.56 |
| medianIntegratedChanges | 66 |
| maxIntegratedChanges | 1986 |
| mergesWithNoUniqueCommits | 0 |

- **What it means** — The average changes per merge are high at 296.56, with a maximum of 1986 changes in a single merge. This indicates that merges often integrate substantial changes, which can be risky.
- **Strengths** — —
- **Needs improvement**
  - Large merges can increase the risk of integration issues and make code reviews more challenging.
- **Suggestions**
  - Encourage more frequent, smaller merges to reduce the complexity and risk associated with large integrations.

### E · Churn & Hotspots

Where change and instability concentrate.

```
totalFilesTouched        ████████████  198
totalDirectoriesTouched  █░░░░░░░░░░░  21
```

#### Most-changed files / directories  ● ok

```
totalFilesTouched        ████████████  198
totalDirectoriesTouched  █░░░░░░░░░░░  21
```

- **Value**

| Item | Value |
| --- | --- |
| totalFilesTouched | 198 |
| totalDirectoriesTouched | 21 |

- **What it means** — The 'Most-changed files / directories' metric shows which files and directories have been modified most frequently. High touch counts and churn in files like 'package.json' and 'package-lock.json' suggest frequent updates, possibly due to dependency changes. High churn in documentation files indicates ongoing updates to planning and implementation artifacts.
- **Strengths**
  - Frequent updates to documentation suggest active maintenance.
- **Needs improvement**
  - High churn in 'package-lock.json' may indicate instability in dependencies.
- **Suggestions**
  - Review dependency management practices to reduce churn in 'package-lock.json'.
  - Ensure documentation updates are well-coordinated to avoid unnecessary churn.

#### Churn rate over time  ● ok

- **Value**
  - perMonth
    - 2026-03: 40931
    - 2026-04: 23618
    - 2026-05: 9622
  - totalChurn: 74171

- **What it means** — The 'Churn rate over time' metric indicates the amount of code added and removed over recent months. A high churn rate in March 2026 suggests significant development activity, while the decrease in April and May indicates stabilization or reduced activity.
- **Strengths**
  - High development activity in March indicates progress.
- **Needs improvement**
  - The high churn in March could indicate instability or rework.
- **Suggestions**
  - Analyze the reasons for high churn in March to identify areas for process improvement.
  - Ensure code reviews and testing are thorough to reduce rework.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  63251
totalDeletions  ██░░░░░░░░░░  10920
addDeleteRatio  ░░░░░░░░░░░░  5.79
netLines        ██████████░░  52331
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 63251 |
| totalDeletions | 10920 |
| addDeleteRatio | 5.79 |
| netLines | 52331 |

- **What it means** — The 'Add/delete ratio' metric shows a high ratio of additions to deletions, indicating that more code is being added than removed. This suggests growth in the codebase, which can be positive if managed well.
- **Strengths**
  - High add/delete ratio indicates codebase growth.
- **Needs improvement**
  - Ensure that code growth does not lead to complexity or technical debt.
- **Suggestions**
  - Implement regular code reviews to manage complexity as the codebase grows.
  - Consider refactoring opportunities to maintain code quality.

#### File survival / age  ● ok

```
medianAgeDays         ░░░░░░░░░░░░  1.35
maxAgeDays            █████░░░░░░░  76.88
filesConsidered       ████████████  198
singleTouchFileCount  ████░░░░░░░░  66
```

- **Value**

| Item | Value |
| --- | --- |
| medianAgeDays | 1.35 |
| maxAgeDays | 76.88 |
| filesConsidered | 198 |
| singleTouchFileCount | 66 |

- **What it means** — The 'File survival / age' metric shows that files have a median age of 1.35 days, indicating frequent updates. This suggests active development but may also point to instability if files are being frequently rewritten.
- **Strengths**
  - Frequent updates indicate active development.
- **Needs improvement**
  - Frequent rewriting of files may indicate instability.
- **Suggestions**
  - Investigate why files are frequently rewritten and address underlying issues.
  - Ensure changes are necessary and not due to poor initial implementation.

#### Large-change events  ● ok  **6.12/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 17 |
| largeChangeSharePct | 6.12 |

- **What it means** — The 'Large-change events' metric identifies significant changes, with 17 events exceeding 1000 lines of churn. This can indicate major feature additions or refactoring but may also suggest potential risks if not well-managed.
- **Strengths**
  - Large changes can indicate significant progress or improvements.
- **Needs improvement**
  - Large changes can introduce risks if not properly reviewed.
- **Suggestions**
  - Ensure large changes undergo thorough code reviews and testing.
  - Break down large changes into smaller, manageable parts where possible.

### F · Repository Health Signals

Overall repository health signals.

_No group-overview chart — see the metrics below._

#### Overall hygiene score  ◐ watch  **56.15/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 56.15 |
| componentsContributing | 5 |

- **What it means** — The overall hygiene score of 56.15 indicates a moderate level of codebase health. The score is a weighted average of several components, with strong performance in Commit Size Discipline (100) and Message Quality (84.89). However, low scores in Branching Discipline (7.55) and Collaboration Breadth (0.72) significantly lower the overall score.
- **Strengths**
  - Commit Size Discipline is excellent, indicating well-managed commit sizes.
  - Message Quality is high, suggesting clear and informative commit messages.
- **Needs improvement**
  - Branching Discipline is very low, indicating potential issues with branch management.
  - Collaboration Breadth is extremely low, suggesting limited contributor diversity.
- **Suggestions**
  - Improve branching practices by adopting a more structured branching strategy.
  - Encourage broader collaboration by involving more team members in the codebase.

#### Bus-factor risk flag  ▲ risk  **99.28/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 99.28 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1 and 99.28% of contributions coming from a single author. This indicates a significant risk if the primary contributor becomes unavailable, as much of the project knowledge is concentrated with them.
- **Strengths** — —
- **Needs improvement**
  - High concentration of knowledge with one contributor poses a risk to project continuity.
- **Suggestions**
  - Distribute knowledge by involving more team members in key areas of the codebase.
  - Implement pair programming or code reviews to share knowledge among team members.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

- **Value**
  - strengths
    - Commit Size Discipline: 100
    - Message Quality: 84.89
  - weaknesses
    - Collaboration Breadth: 0.72
    - Branching Discipline: 7.55

- **What it means** — The strengths and weaknesses highlight areas of excellence and concern. Commit Size Discipline and Message Quality are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - Commit Size Discipline is a strength, ensuring manageable and reviewable commits.
  - Message Quality is a strength, aiding in understanding changes.
- **Needs improvement**
  - Collaboration Breadth is a weakness, indicating limited contributor diversity.
  - Branching Discipline is a weakness, suggesting potential issues with branch management.
- **Suggestions**
  - Increase collaboration by encouraging contributions from a wider range of team members.
  - Adopt a more structured branching strategy to improve Branching Discipline.

---
Generated by commit-whisper v1.1.1 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-18T20:33:06.650Z
