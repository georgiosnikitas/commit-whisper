# commit-whisper — commit-whisper

_commit-whisper · 135 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and limited collaboration.

The repository has experienced a burst of activity over a short period, with a high volume of commits and adherence to conventional commit standards. However, the project is heavily reliant on a single contributor, posing a high bus-factor risk. Additionally, the lack of collaboration and branching discipline are areas of concern that need addressing to ensure long-term sustainability and team resilience.

- High commit volume with 135 commits in 14 days.
- 82.22% adherence to conventional commit standards.
- High bus-factor risk with 94.81% of contributions from one author.
- Low collaboration with 0% co-authored commits.
- Branching discipline is weak with 89.63% direct-to-default commits.

## Explanation

The repository has seen a significant amount of activity in a short span, with 135 commits over 14 days, indicating a highly active development phase. The commit cadence shows frequent updates, with an average interval of approximately 2.6 hours between commits, suggesting rapid development cycles.

Commit messages are generally well-structured, with 82.22% adhering to conventional commit standards, and 97.78% using the imperative mood. This indicates a strong focus on message quality, which is crucial for maintaining clarity in project history.

However, the project faces a high bus-factor risk, as 94.81% of the contributions come from a single author. This concentration of knowledge poses a significant risk to project continuity if the primary contributor becomes unavailable.

Collaboration is notably low, with no co-authored commits, indicating a lack of teamwork and shared knowledge. This is compounded by weak branching discipline, as 89.63% of commits are made directly to the default branch, which can lead to integration challenges and reduced code review opportunities.

## Coaching

The repository is in a critical phase of development with high activity but faces risks due to knowledge concentration and limited collaboration. This improvement plan addresses these issues to enhance sustainability and team resilience.

### 1. Knowledge Distribution

- Encourage knowledge sharing by involving more contributors in key areas, reducing the bus-factor risk from 1.
- Implement pair programming or code review practices to distribute knowledge and reduce reliance on a single contributor.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging team members to work together on commits, aiming to increase the current 0% co-authored commits.
- Facilitate regular team meetings to discuss ongoing work and share insights, fostering a collaborative environment.

### 3. Branching Discipline

- Adopt a branching strategy that reduces the 89.63% direct-to-default commit rate, such as feature branches or pull requests.
- Implement a code review process for all merges to ensure quality and consistency, leveraging the existing 5.19% merge-based workflow.

_The top priorities are to reduce the bus-factor risk by distributing knowledge and to enhance collaboration through co-authorship and improved branching discipline. Addressing these areas will mitigate risks and improve the project's long-term health._

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
2026-06-20  █░░░░░░░░░░░  3
```

#### Commit volume over time  ● ok  `▁▁▁▁▅▅█▁▆█▁`

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
| 2026-06-20 | 3 |

- **What it means** — The commit volume shows a significant increase in activity over the analyzed period, with a peak in the third week of June. This suggests a concentrated effort or a deadline-driven push during this time.
- **Strengths**
  - High commit volume indicates active development.
- **Needs improvement** — —
- **Suggestions**
  - Maintain consistent commit activity to avoid burnout and ensure steady progress.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9340.31
medianIntervalSeconds   █░░░░░░░░░░░  720.5
intervalCount           ░░░░░░░░░░░░  134
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9340.31 |
| medianIntervalSeconds | 720.5 |
| intervalCount | 134 |

- **What it means** — The average commit interval is approximately 2.6 hours, with a median of 12 minutes, indicating frequent commits. This suggests a healthy, iterative development process.
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
- **What it means** — There are no dormant periods within the analyzed timeframe, indicating continuous activity. This is a positive sign of sustained engagement with the project.
- **Strengths**
  - Continuous activity with no dormant periods.
- **Needs improvement** — —
- **Suggestions**
  - Ensure team members are not overworking by monitoring workload and encouraging breaks.

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

- **What it means** — The project is 14 days old, indicating it is in its early stages. This is a critical time for setting up foundational structures and processes.
- **Strengths**
  - Active development from the start.
- **Needs improvement** — —
- **Suggestions**
  - Focus on establishing strong development practices and documentation early on.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  132
p90          ███░░░░░░░░░  1225.6
max          ████████████  4428
mean         █░░░░░░░░░░░  487.91
commitCount  ░░░░░░░░░░░░  135
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 132 |
| p90 | 1225.6 |
| max | 4428 |
| mean | 487.91 |
| commitCount | 135 |

- **What it means** — The commit size distribution shows a wide range, with a median of 132 lines and a maximum of 4428 lines. This suggests variability in commit sizes, which can be typical in early project stages.
- **Strengths** — —
- **Needs improvement**
  - Large commits can be difficult to review and integrate.
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
24  ██░░░░░░░░░░  5
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
    - 24: 5
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 23

- **What it means** — Most commits occur between 19:00 and 21:00 UTC, with a peak on Thursdays. This pattern may reflect team preferences or deadlines.
- **Strengths** — —
- **Needs improvement**
  - Evening work may indicate potential work-life balance issues.
- **Suggestions**
  - Encourage flexible working hours to accommodate different time zones and personal schedules.

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

- **What it means** — The repository has a total of 2 contributors, both of whom are active within the last 90 days. This indicates a small team size, which can be manageable but may also suggest limited diversity in ideas and skills.
- **Strengths**
  - Both contributors are active, indicating engagement.
- **Needs improvement**
  - The team size is small, which could lead to bottlenecks or over-reliance on individuals.
- **Suggestions**
  - Consider recruiting additional contributors to diversify skills and reduce risk of over-reliance.

#### Contribution distribution  ▲ risk  **94.81/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.81 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.81% of commits and 99.35% of lines of code. This indicates a significant imbalance in contributions.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one individual, which can lead to knowledge silos.
- **Suggestions**
  - Encourage more balanced contributions by involving the second contributor in more tasks or onboarding new contributors.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.81 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. If this person were unavailable, it could significantly impact the project.
- **Strengths** — —
- **Needs improvement**
  - The bus factor is low, indicating a high risk if the main contributor becomes unavailable.
- **Suggestions**
  - Increase the bus factor by distributing knowledge and responsibilities among more contributors.

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

- **What it means** — Both contributors are new within the last 90 days, with no departures in the last 180 days. This suggests recent growth but also a lack of long-term contributors.
- **Strengths**
  - No contributors have departed recently, indicating stability.
- **Needs improvement**
  - All contributors are new, which might mean a lack of historical knowledge.
- **Suggestions**
  - Focus on retaining current contributors to build long-term project knowledge.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              ████████░░░░  106
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/retrieve                   ████░░░░░░░░  45
src/render/html                ███░░░░░░░░░  40
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
      - touchCount: 106
      - authorCount: 2
      - topAuthorSharePct: 88.68
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
      - touchCount: 40
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
      - touchCount: 8
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/config/env.test.ts
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
    - src/assemble/report.test.ts
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/render/terminal/terminal-renderer.test.ts
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating potential knowledge silos.
- **Strengths** — —
- **Needs improvement**
  - High ownership concentration in specific areas, which can lead to bottlenecks.
- **Suggestions**
  - Encourage cross-training and code reviews to spread knowledge across the team.

#### Co-authorship / collaboration signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 0 |
| coAuthoredSharePct | 0 |
| totalCoAuthorTrailers | 0 |
| distinctCoAuthors | 0 |

- **What it means** — There are no commits with co-authors, indicating a lack of collaboration in commit activities. This might suggest isolated work practices.
- **Strengths** — —
- **Needs improvement**
  - Lack of co-authorship suggests limited collaboration.
- **Suggestions**
  - Promote pair programming or collaborative code reviews to enhance teamwork.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **50.37/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 50.37 |
| commitCount | 135 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a median length of 64 characters and no empty messages. Half of the commits include a body, suggesting detailed documentation for significant changes.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
- **Needs improvement**
  - Increase the percentage of commits with detailed bodies.
- **Suggestions**
  - Encourage developers to include more detailed bodies in commit messages, especially for complex changes.

#### Conventional Commits adherence  ● ok  **82.22/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 111 |
| adherenceSharePct | 82.22 |
| subjectsConsidered | 135 |

- **What it means** — The repository shows strong adherence to the Conventional Commits standard, with 82.22% of commits following the convention. This helps maintain clarity and consistency in commit messages.
- **Strengths**
  - High adherence to Conventional Commits, enhancing clarity.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Conduct a review session on Conventional Commits to ensure all team members are familiar with the guidelines.

#### Imperative-mood / style signal  ● ok  **97.78/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 135 |
| imperativeMoodSharePct | 97.78 |
| capitalizedSubjectSharePct | 23.7 |
| noTrailingPeriodSharePct | 99.26 |

- **What it means** — The use of imperative mood in commit messages is very high at 97.78%, which is a best practice for clarity and consistency. However, only 23.7% of subjects are capitalized, which could be improved for uniformity.
- **Strengths**
  - High use of imperative mood, which is a best practice.
- **Needs improvement**
  - Increase the capitalization of commit message subjects.
- **Suggestions**
  - Encourage capitalization of the first word in commit messages to improve consistency.

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 135 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information. This is a strong indicator of good communication practices within the team.
- **Strengths**
  - All commit messages are informative with no low-information entries.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.19/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.19 |
| commitCount | 135 |

- **What it means** — Only 5.19% of commits reference an issue or ticket, which suggests that the linkage between commits and issue tracking could be improved for better traceability.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue or ticket references in commit messages.
- **Suggestions**
  - Encourage developers to reference relevant issues or tickets in commit messages to improve traceability.

#### Revert / fixup / amend signal  ● ok  **0.74/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.74 |
| commitCount | 135 |

- **What it means** — The low churn of intent (0.74%) indicates minimal need for reverts or fixups, suggesting that commits are generally well-considered and stable.
- **Strengths**
  - Low churn of intent, indicating stable and well-considered commits.
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

#### Branch/merge topology summary  ● ok  **5.19/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 135 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.19 |
| regularCommitCount | 127 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows the repository's commit structure, indicating a merge-based workflow with 135 total commits, of which 7 are merge commits. The low merge share percentage (5.19%) suggests infrequent merging, with most commits being regular ones.
- **Strengths**
  - The presence of a structured merge-based workflow.
- **Needs improvement**
  - Increase the frequency of merges to better integrate changes.
- **Suggestions**
  - Encourage more frequent merging to ensure changes are integrated regularly, which can help in maintaining code quality and reducing integration issues.

#### Merge vs. rebase tendency  ● ok  **5.19/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.19 |
| firstParentLinearityPct | 94.81 |

- **What it means** — The repository exhibits a mixed tendency between merging and rebasing, with a high first parent linearity percentage (94.81%). This suggests a preference for maintaining a linear history, though some merges are still present.
- **Strengths**
  - High first parent linearity indicates a clean and understandable commit history.
- **Needs improvement**
  - Clarify the team's strategy on when to use merge vs. rebase to ensure consistency.
- **Suggestions**
  - Define clear guidelines on when to use merging versus rebasing to maintain a consistent workflow and avoid confusion.

#### Direct-to-default-branch rate  ▲ risk  **89.63/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 121 |
| directToDefaultSharePct | 89.63 |
| viaMergeCount | 14 |
| mainlineCommitCount | 128 |
| totalCommits | 135 |

- **What it means** — A high percentage (89.63%) of commits are made directly to the default branch, indicating a tendency to bypass feature branches.
- **Strengths** — —
- **Needs improvement**
  - Reduce direct commits to the default branch to encourage feature branch usage.
- **Suggestions**
  - Implement a policy to encourage the use of feature branches for new work, which can improve code review processes and reduce the risk of introducing errors directly into the mainline.

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

- **What it means** — No long-lived branches were detected, with the longest branch lasting only 0.01 days. This suggests efficient branch management and quick integration of changes.
- **Strengths**
  - Efficient branch management with no long-lived branches.
- **Needs improvement** — —
- **Suggestions** — —

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

- **What it means** — The average number of changes per merge is 60.71, with a median of 29 and a maximum of 234. This indicates variability in the size of changes being merged.
- **Strengths**
  - No merges with no unique commits, indicating meaningful integration.
- **Needs improvement**
  - Reduce the variability in the size of changes being merged to ensure more consistent integration.
- **Suggestions**
  - Encourage smaller, more frequent merges to maintain a steady flow of changes and reduce the risk of large, disruptive integrations.

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

- **What it means** — This metric identifies the files and directories that have been changed most frequently. High touch counts and churn in files like `package-lock.json` and `src/cli/interactive.ts` suggest these areas are under active development or may be unstable.
- **Strengths**
  - Active development in `src/cli` indicates ongoing feature enhancements.
- **Needs improvement**
  - High churn in `package-lock.json` suggests potential dependency instability.
- **Suggestions**
  - Review dependency management practices to stabilize `package-lock.json`.
  - Consider refactoring `src/cli/interactive.ts` to reduce churn.

#### Churn rate over time  ● ok  `▅`

- **Value**
  - perMonth
    - 2026-06: 65868
  - totalChurn: 65868

- **What it means** — The churn rate over time shows a high level of activity with 65,868 lines changed in June 2026. This indicates significant development or refactoring efforts.
- **Strengths**
  - High commit count (135) suggests active development and collaboration.
- **Needs improvement**
  - High churn may indicate instability or frequent changes in requirements.
- **Suggestions**
  - Ensure changes are well-documented to maintain codebase stability.
  - Conduct regular code reviews to manage and understand churn.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  56252
totalDeletions  ██░░░░░░░░░░  9616
addDeleteRatio  ░░░░░░░░░░░░  5.85
netLines        ██████████░░  46636
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 56252 |
| totalDeletions | 9616 |
| addDeleteRatio | 5.85 |
| netLines | 46636 |

- **What it means** — The add/delete ratio of 5.85 indicates that for every line deleted, nearly six lines were added. This suggests expansion of the codebase, possibly due to new features or enhancements.
- **Strengths**
  - Positive net lines (46,636) indicate growth and feature development.
- **Needs improvement** — —
- **Suggestions**
  - Monitor for potential code bloat and ensure new code is necessary and efficient.

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

- **What it means** — The median file age of 1.2 days suggests frequent updates, which may indicate active development or instability. A max age of 9.23 days shows some files remain stable longer.
- **Strengths**
  - Frequent updates can reflect active maintenance and responsiveness to issues.
- **Needs improvement**
  - Short file age may indicate instability or frequent requirement changes.
- **Suggestions**
  - Identify files with frequent changes and assess if they can be stabilized.
  - Ensure documentation is updated to reflect frequent changes.

#### Large-change events  ● ok  **13.33/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 18 |
| largeChangeSharePct | 13.33 |

- **What it means** — There were 18 large-change events, accounting for 13.33% of changes. This indicates significant updates or refactoring efforts, which can be disruptive if not managed well.
- **Strengths**
  - Large changes can indicate major improvements or feature additions.
- **Needs improvement**
  - Frequent large changes can disrupt team workflow and introduce bugs.
- **Suggestions**
  - Plan large changes carefully and communicate them clearly to the team.
  - Break down large changes into smaller, manageable parts where possible.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  91.11
Commit Size Discipline  ███████████░  81.78
```

#### Overall hygiene score  ◐ watch  **56.77/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 56.77 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 56.77 indicates a moderate level of codebase health. The score is a weighted average of several components, with Message Quality and Commit Size Discipline contributing positively. However, low scores in Branching Discipline and Collaboration Breadth significantly lower the overall score.
- **Strengths**
  - High Message Quality
  - Good Commit Size Discipline
- **Needs improvement**
  - Branching Discipline
  - Collaboration Breadth
- **Suggestions**
  - Improve branching strategies to increase the Branching Discipline score.
  - Encourage broader collaboration to enhance Collaboration Breadth.

#### Bus-factor risk flag  ▲ risk  **94.81/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.81 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, meaning that a single person holds most of the knowledge (94.81% contribution). This poses a significant risk if that person becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - Reduce knowledge concentration by distributing responsibilities more evenly across the team.
- **Suggestions**
  - Implement pair programming or code reviews to share knowledge.
  - Encourage documentation and knowledge sharing sessions.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  91.11
Commit Size Discipline  ███████████░  81.78
```

- **Value**
  - strengths
    - Message Quality: 91.11
    - Commit Size Discipline: 81.78
  - weaknesses
    - Collaboration Breadth: 5.19
    - Branching Discipline: 10.37

- **What it means** — The strengths and weaknesses highlight areas of high performance and areas needing improvement. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - High Message Quality
  - Good Commit Size Discipline
- **Needs improvement**
  - Collaboration Breadth
  - Branching Discipline
- **Suggestions**
  - Foster a more collaborative environment to improve Collaboration Breadth.
  - Develop better branching practices to enhance Branching Discipline.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:42:56.059Z
