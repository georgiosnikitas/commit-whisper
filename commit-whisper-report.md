# commit-whisper — commit-whisper

_commit-whisper · 134 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and weak collaboration.

This repository has experienced a burst of activity over a short period, with a high volume of commits and a strong adherence to commit message quality. However, it faces challenges with a high bus-factor risk due to knowledge concentration in one contributor, and limited collaboration as indicated by low co-authorship and branching discipline scores. Addressing these issues is crucial for sustainable development and reducing risk.

- Commit volume is high with 134 commits in June, indicating active development.
- Bus-factor risk is high with 94.78% of contributions from one author, posing a knowledge concentration risk.
- Collaboration is limited with no co-authored commits and a low collaboration breadth score of 5.22.
- Branching discipline is weak with 89.55% of commits going directly to the default branch.
- Commit message quality is strong with 82.09% adherence to conventional commits.

## Explanation

The repository has seen a significant amount of activity in a short span, with 134 commits in June alone. This indicates a highly active development phase. The commit frequency shows a median interval of 723 seconds between commits, suggesting rapid iterations.

Despite the high activity, the repository is at risk due to a high bus-factor. With 94.78% of contributions coming from a single contributor, there is a significant concentration of knowledge, which could be problematic if this contributor becomes unavailable.

Collaboration appears limited, as evidenced by the absence of co-authored commits and a low collaboration breadth score of 5.22. This suggests that development is not being shared effectively among team members.

Branching discipline is another area of concern. With 89.55% of commits going directly to the default branch, there is a lack of structured branching strategy, which can lead to integration issues and complicate code management.

On a positive note, the repository excels in commit message quality, with 82.09% adherence to conventional commit standards, indicating clear and informative commit messages.

## Coaching

The repository is currently in a phase of intense development activity, but it faces significant risks due to knowledge concentration and limited collaboration. This improvement plan focuses on addressing these risks to ensure sustainable development and reduce potential disruptions.

### 1. Knowledge Distribution

- Encourage knowledge sharing by involving more contributors in key areas, especially where one contributor holds 100% ownership.
- Implement pair programming or code reviews to distribute knowledge and reduce the bus-factor risk.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging team members to work together on commits, which can be facilitated through pair programming or collaborative tools.
- Increase the use of pull requests to foster discussion and review, enhancing team collaboration and code quality.

### 3. Branching Strategy

- Adopt a branching strategy such as Git Flow or GitHub Flow to improve branching discipline and reduce direct commits to the default branch.
- Train the team on effective branching practices to ensure better code integration and management.

_The top priorities are to reduce the bus-factor risk by distributing knowledge and to enhance collaboration through co-authorship and improved branching strategies. Implementing these changes will mitigate risks and support sustainable development._

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
2026-06-20  █░░░░░░░░░░░  2
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
| 2026-06-20 | 2 |

- **What it means** — The commit volume shows a significant increase in activity over the analyzed period, with a peak in the third week of June. This suggests a period of intense development or a push to meet a deadline.
- **Strengths**
  - High activity in the third week indicates strong team engagement.
- **Needs improvement**
  - The uneven distribution of commits suggests potential bottlenecks or rushed work.
- **Suggestions**
  - Encourage more consistent commit activity to avoid last-minute rushes.
  - Investigate the reasons for low activity on certain days to ensure balanced workload.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9407.89
medianIntervalSeconds   █░░░░░░░░░░░  723
intervalCount           ░░░░░░░░░░░░  133
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9407.89 |
| medianIntervalSeconds | 723 |
| intervalCount | 133 |

- **What it means** — The commit cadence indicates a high frequency of commits, with a median interval of 723 seconds, suggesting rapid iterations and possibly small, incremental changes.
- **Strengths**
  - Frequent commits suggest active development and quick iterations.
- **Needs improvement**
  - The large difference between average and median intervals suggests some periods of inactivity or large gaps between commits.
- **Suggestions**
  - Aim for more consistent commit intervals to maintain steady progress.
  - Review workflow to identify and address causes of longer commit intervals.

#### Active vs. dormant periods  ● ok

```
activePeriods   ████████████  1
dormantPeriods  ░░░░░░░░░░░░  0
```

- **Value** — 14
- **What it means** — There are no dormant periods within the analyzed timeframe, indicating continuous activity and engagement from the team.
- **Strengths**
  - Continuous activity with no dormant periods shows strong team engagement.
- **Needs improvement** — —
- **Suggestions** — —

#### Project age & lifespan  ● ok

```
lifespanDays  ████████████  14.48
ageDays       ████████████  14.49
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 14.48 |
| ageDays | 14.49 |

- **What it means** — The project is very young, with a lifespan of just over 14 days, indicating it is in its initial development phase.
- **Strengths**
  - Rapid development in the early stages of the project.
- **Needs improvement** — —
- **Suggestions**
  - Continue to monitor development pace as the project matures to ensure sustainability.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  128
p90          ███░░░░░░░░░  1233.7
max          ████████████  4428
mean         █░░░░░░░░░░░  483.69
commitCount  ░░░░░░░░░░░░  134
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 128 |
| p90 | 1233.7 |
| max | 4428 |
| mean | 483.69 |
| commitCount | 134 |

- **What it means** — The commit size distribution shows a wide range, with a median size of 128 and a maximum of 4428, indicating variability in the scope of changes per commit.
- **Strengths**
  - The median commit size suggests manageable, incremental changes.
- **Needs improvement**
  - The large maximum commit size could indicate occasional large, potentially risky changes.
- **Suggestions**
  - Encourage breaking down large changes into smaller, more manageable commits to reduce risk.
  - Review larger commits to ensure they are necessary and well-documented.

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
24  █░░░░░░░░░░░  4
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
    - 24: 4
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 22

- **What it means** — Most commits occur during typical working hours, with a peak in the late afternoon, suggesting a standard work schedule. However, there is some activity outside these hours, indicating flexibility or overtime work.
- **Strengths**
  - Commit activity aligns with standard working hours, suggesting good work-life balance.
- **Needs improvement**
  - Some activity outside regular hours could indicate overtime or work pressure.
- **Suggestions**
  - Ensure team members are not overworking by monitoring off-hours activity.
  - Encourage a balanced workload to prevent burnout.

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
  - The contributor count is low, which may pose risks for knowledge sharing and workload distribution.
- **Suggestions**
  - Consider recruiting additional contributors to diversify skills and reduce dependency on a small team.

#### Contribution distribution  ▲ risk  **94.78/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.78 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.78% of commits and 99.34% of lines of code. This suggests a potential imbalance in workload and knowledge concentration.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one individual can lead to bottlenecks and risks if that person becomes unavailable.
- **Suggestions**
  - Encourage more balanced contributions by distributing tasks more evenly among team members.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.78 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. This is a risk for project continuity if that contributor leaves or is unavailable.
- **Strengths** — —
- **Needs improvement**
  - The low bus factor indicates a critical dependency on one contributor.
- **Suggestions**
  - Increase the bus factor by involving more contributors in key areas of the project.

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

- **What it means** — All contributors are new within the last 90 days, with no departures in the last 180 days. This suggests recent growth in the team without losing members.
- **Strengths**
  - No contributors have departed, indicating stability.
- **Needs improvement** — —
- **Suggestions**
  - Maintain engagement strategies to ensure new contributors remain active.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              ████████░░░░  104
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/retrieve                   ████░░░░░░░░  45
src/render/html                ███░░░░░░░░░  38
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
      - touchCount: 104
      - authorCount: 2
      - topAuthorSharePct: 88.46
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
      - touchCount: 38
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
    - src/config/env.test.ts
      - touchCount: 8
      - authorCount: 1
      - topAuthorSharePct: 100
    - commit-whisper-report.html
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
    - src/render/terminal/terminal-renderer.test.ts
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating a lack of shared ownership.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in many areas can lead to knowledge silos.
- **Suggestions**
  - Promote code reviews and pair programming to increase shared ownership and knowledge transfer.

#### Co-authorship / collaboration signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 0 |
| coAuthoredSharePct | 0 |
| totalCoAuthorTrailers | 0 |
| distinctCoAuthors | 0 |

- **What it means** — There are no commits with co-authors, indicating a lack of collaborative coding practices.
- **Strengths** — —
- **Needs improvement**
  - The absence of co-authored commits suggests limited collaboration.
- **Suggestions**
  - Encourage practices like pair programming or code reviews to foster collaboration.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 50 |
| commitCount | 134 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a median length of 63.5 characters and no empty messages. Half of the commits include a body, suggesting detailed documentation for significant changes.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
- **Needs improvement**
  - Increase the percentage of commits with a body to provide more context.
- **Suggestions**
  - Encourage developers to add more detailed bodies to commit messages, especially for complex changes.

#### Conventional Commits adherence  ● ok  **82.09/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 110 |
| adherenceSharePct | 82.09 |
| subjectsConsidered | 134 |

- **What it means** — The repository shows strong adherence to the Conventional Commits standard, with 82.09% of commits following the convention. This helps maintain clarity and consistency in commit messages.
- **Strengths**
  - High adherence to Conventional Commits, enhancing clarity.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Conduct a team review of the Conventional Commits guidelines to ensure full understanding and compliance.

#### Imperative-mood / style signal  ● ok  **97.76/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 134 |
| imperativeMoodSharePct | 97.76 |
| capitalizedSubjectSharePct | 23.88 |
| noTrailingPeriodSharePct | 99.25 |

- **What it means** — The use of imperative mood in commit messages is very high at 97.76%, which is a best practice for clarity and consistency. However, only 23.88% of subjects are capitalized, which could be improved for uniformity.
- **Strengths**
  - High use of imperative mood, which is a best practice.
- **Needs improvement**
  - Increase the percentage of capitalized subjects for consistency.
- **Suggestions**
  - Encourage the team to capitalize the first word of commit messages to align with best practices.

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 134 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information. This is a strong indicator of good communication practices within the team.
- **Strengths**
  - All commit messages are informative, with no low-information messages.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.22/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.22 |
| commitCount | 134 |

- **What it means** — Only 5.22% of commits reference an issue or ticket, which suggests that many changes may not be linked to tracked issues. This can make it harder to trace changes back to specific tasks or bugs.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue or ticket references in commit messages.
- **Suggestions**
  - Implement a policy to include issue or ticket references in commit messages where applicable.

#### Revert / fixup / amend signal  ● ok  **0.75/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.75 |
| commitCount | 134 |

- **What it means** — The low number of reverts and no fixups or squashes indicate minimal churn, suggesting that commits are generally well-considered and stable.
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

#### Branch/merge topology summary  ● ok  **5.22/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 134 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.22 |
| regularCommitCount | 126 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — The repository has a total of 134 commits, with 7 being merge commits, indicating a merge-based workflow. The low percentage of merge commits (5.22%) suggests that most changes are committed directly rather than through feature branches.
- **Strengths**
  - The workflow is clear and consistent, with a low number of merge commits indicating streamlined integration.
- **Needs improvement**
  - Consider increasing the use of feature branches to enhance code review and testing processes.
- **Suggestions**
  - Encourage the team to use feature branches more frequently to facilitate better code reviews and testing before merging.

#### Merge vs. rebase tendency  ● ok  **5.22/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.22 |
| firstParentLinearityPct | 94.78 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a high first-parent linearity percentage (94.78%). This suggests that while merges are used, the history is kept relatively linear, possibly through rebasing or squashing before merging.
- **Strengths**
  - Maintaining a linear history helps in understanding the project history and simplifies debugging.
- **Needs improvement**
  - The mixed tendency might indicate inconsistency in workflow practices.
- **Suggestions**
  - Standardize the workflow by deciding on a preferred method (merge or rebase) and ensure the team follows it consistently.

#### Direct-to-default-branch rate  ▲ risk  **89.55/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 120 |
| directToDefaultSharePct | 89.55 |
| viaMergeCount | 14 |
| mainlineCommitCount | 127 |
| totalCommits | 134 |

- **What it means** — A high percentage (89.55%) of commits are made directly to the default branch, indicating a preference for direct commits over feature branches.
- **Strengths**
  - Direct commits can speed up the development process when changes are small and low-risk.
- **Needs improvement**
  - High direct-to-default rate can lead to less thorough code reviews and testing.
- **Suggestions**
  - Encourage the use of pull requests and feature branches to improve code quality and collaboration.

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

- **What it means** — There are no long-lived branches, with the longest branch lasting only 0.01 days. This indicates that branches are either merged quickly or not used extensively.
- **Strengths**
  - Quick merging of branches can lead to faster integration and deployment.
- **Needs improvement**
  - Lack of long-lived branches might suggest insufficient use of feature branches for larger tasks.
- **Suggestions**
  - For larger features, consider using branches that last longer to allow for more comprehensive development and testing.

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

- **What it means** — The average number of changes per merge is 60.71, with a maximum of 234 changes in a single merge. This suggests that some merges integrate a significant amount of work, which could complicate reviews and increase the risk of integration issues.
- **Strengths**
  - Merges are being used effectively to integrate changes.
- **Needs improvement**
  - Large merges can be difficult to review and may introduce bugs.
- **Suggestions**
  - Encourage more frequent, smaller merges to make code reviews easier and reduce the risk of integration issues.

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
    - 2026-06: 64815
  - totalChurn: 64815

- **What it means** — The 'Churn rate over time' metric indicates the amount of code added and removed, with a total churn of 64,815 lines in June 2026. This high churn suggests significant development activity or refactoring.
- **Strengths**
  - High development activity indicates progress and adaptation.
- **Needs improvement**
  - Sustained high churn could indicate instability or frequent changes in requirements.
- **Suggestions**
  - Ensure changes are well-documented to maintain codebase stability.
  - Consider code reviews to manage and understand the impact of high churn.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  55682
totalDeletions  ██░░░░░░░░░░  9133
addDeleteRatio  ░░░░░░░░░░░░  6.1
netLines        ██████████░░  46549
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 55682 |
| totalDeletions | 9133 |
| addDeleteRatio | 6.1 |
| netLines | 46549 |

- **What it means** — The 'Add/delete ratio' of 6.1 indicates that for every line deleted, about six lines are added. This suggests a growing codebase, which is typical in active development phases.
- **Strengths**
  - A positive add/delete ratio indicates expansion and feature development.
- **Needs improvement** — —
- **Suggestions**
  - Monitor the growth to ensure maintainability and avoid unnecessary complexity.

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
  - Frequent updates can indicate responsiveness to change.
- **Needs improvement**
  - Short file lifespan may suggest instability or frequent requirement changes.
- **Suggestions**
  - Stabilize frequently changing files by reviewing their design and requirements.

#### Large-change events  ● ok  **12.69/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 17 |
| largeChangeSharePct | 12.69 |

- **What it means** — The 'Large-change events' metric identifies 17 events with significant churn, comprising 12.69% of all changes. This indicates periods of intense development or refactoring.
- **Strengths**
  - Large changes can be part of planned refactoring or feature rollouts.
- **Needs improvement**
  - Frequent large changes can disrupt stability and increase risk.
- **Suggestions**
  - Plan large changes carefully and ensure thorough testing to mitigate risks.
  - Communicate large changes clearly to the team to align efforts.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  91.05
Commit Size Discipline  ███████████░  82.67
```

#### Overall hygiene score  ◐ watch  **56.97/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 56.97 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 56.97 indicates a moderate level of codebase health. The score is a weighted average of several components, with strong performance in Message Quality (91.05) and Commit Size Discipline (82.67). However, low scores in Branching Discipline (10.45) and Collaboration Breadth (5.22) significantly reduce the overall score.
- **Strengths**
  - High Message Quality indicates clear and informative commit messages.
  - Commit Size Discipline suggests well-managed and appropriately sized commits.
- **Needs improvement**
  - Branching Discipline is very low, indicating potential issues with how branches are managed.
  - Collaboration Breadth is also low, suggesting limited participation across the team.
- **Suggestions**
  - Improve Branching Discipline by adopting a more structured branching strategy, such as Git Flow or feature branching.
  - Enhance Collaboration Breadth by encouraging more team members to contribute to the codebase.

#### Bus-factor risk flag  ▲ risk  **94.78/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.78 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, meaning that a single person holds most of the knowledge about the codebase. This is risky as it creates a dependency on one individual, with 94.78% of contributions coming from the top author.
- **Strengths** — —
- **Needs improvement**
  - The high concentration of knowledge in one individual poses a significant risk to project continuity.
- **Suggestions**
  - Distribute knowledge more evenly by encouraging code reviews and pair programming.
  - Document key processes and code areas to reduce dependency on a single contributor.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  91.05
Commit Size Discipline  ███████████░  82.67
```

- **Value**
  - strengths
    - Message Quality: 91.05
    - Commit Size Discipline: 82.67
  - weaknesses
    - Collaboration Breadth: 5.22
    - Branching Discipline: 10.45

- **What it means** — The strengths and weaknesses highlight areas of high and low performance. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - Strong Message Quality and Commit Size Discipline indicate good practices in these areas.
- **Needs improvement**
  - Collaboration Breadth and Branching Discipline need significant improvement.
- **Suggestions**
  - Focus on improving Collaboration Breadth by involving more team members in the development process.
  - Enhance Branching Discipline by implementing a more consistent branching strategy.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:34:40.307Z
