# commit-whisper — commit-whisper

_commit-whisper · 138 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows strong commit activity but faces challenges with collaboration and branching discipline.

This repository has demonstrated high commit activity over a short period, with a significant concentration of contributions from one author. While commit message quality is strong, the repository struggles with collaboration breadth and branching discipline, posing risks to project sustainability and knowledge distribution.

- High commit volume with 138 commits in 14 days.
- Commit activity is concentrated with 94.93% from one contributor.
- Strong adherence to conventional commit standards at 81.88%.
- Low collaboration breadth with no co-authored commits.
- Branching discipline is weak with 89.86% direct-to-default commits.

## Explanation

The repository has experienced a high level of activity, with 138 commits over a 14-day period, indicating a rapid development pace. The commit volume peaked significantly on certain days, such as June 15 and June 18, with 32 commits each. This suggests bursts of intense development activity.

Commit frequency shows a median interval of 680 seconds between commits, reflecting a consistent workflow. However, the contribution distribution is heavily skewed, with one contributor responsible for 94.93% of commits, indicating a high bus-factor risk. This concentration of knowledge could pose a risk if the primary contributor becomes unavailable.

Commit messages are generally well-structured, with 81.88% adhering to conventional commit standards and 97.83% using the imperative mood. This suggests a strong focus on maintaining high-quality commit documentation.

Despite the high activity, collaboration breadth is limited, as evidenced by the absence of co-authored commits. This lack of collaboration could hinder knowledge sharing and team cohesion.

Branching discipline is notably weak, with 89.86% of commits going directly to the default branch. This practice can complicate code management and integration, increasing the risk of conflicts and reducing the effectiveness of code reviews.

## Coaching

The repository is active and productive but faces significant risks due to concentrated contributions and weak branching practices. This improvement plan addresses these issues to enhance sustainability and collaboration.

### 1. Branching Discipline

- Implement a branching strategy to reduce the 89.86% direct-to-default commit rate. Encourage feature branches for new developments and bug fixes.
- Increase the use of merge requests to facilitate code reviews and improve integration processes.
- Educate the team on the benefits of structured branching to improve the current 10.14% branching discipline score.

### 2. Collaboration Breadth

- Encourage pair programming or code reviews to increase collaboration and reduce the bus-factor risk.
- Introduce regular team meetings to discuss ongoing work and share knowledge, addressing the current 5.07% collaboration breadth score.
- Promote the use of co-authored commits to document collaborative efforts and enhance team visibility.

### 3. Knowledge Distribution

- Develop documentation and onboarding processes to mitigate the high bus-factor risk, ensuring knowledge is shared across the team.
- Encourage the secondary contributor to take on more significant roles to balance the contribution distribution.

_The top priorities are to improve branching discipline and collaboration breadth. Start by implementing a structured branching strategy and encouraging more collaborative practices to distribute knowledge and reduce risks._

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
2026-06-20  ██░░░░░░░░░░  6
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
| 2026-06-20 | 6 |

- **What it means** — The commit volume shows a significant increase over the analyzed period, with a peak of 32 commits on two separate days. This suggests a period of intense development activity, particularly in the third week of June.
- **Strengths**
  - High productivity in the third week of June.
- **Needs improvement** — —
- **Suggestions**
  - Maintain consistent commit activity to avoid burnout and ensure steady progress.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9141.92
medianIntervalSeconds   █░░░░░░░░░░░  680
intervalCount           ░░░░░░░░░░░░  137
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9141.92 |
| medianIntervalSeconds | 680 |
| intervalCount | 137 |

- **What it means** — The average commit interval is approximately 2.5 hours, with a median of 11 minutes. This indicates frequent commits, suggesting active development and regular updates.
- **Strengths**
  - Frequent commits indicate active development.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that frequent commits are meaningful and not just minor changes to maintain code quality.

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
  - Continue maintaining active development to keep the project momentum.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████████  14.5
ageDays       ████████████  14.5
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 14.5 |
| ageDays | 14.5 |

- **What it means** — The project is 14.5 days old, with active development throughout its entire lifespan. This suggests a new project with a strong start.
- **Strengths**
  - Strong start with continuous activity since inception.
- **Needs improvement** — —
- **Suggestions**
  - Plan for long-term sustainability as the project matures.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  149
p90          ███░░░░░░░░░  1201.3
max          ████████████  4428
mean         █░░░░░░░░░░░  497.73
commitCount  ░░░░░░░░░░░░  138
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 149 |
| p90 | 1201.3 |
| max | 4428 |
| mean | 497.73 |
| commitCount | 138 |

- **What it means** — The commit size distribution shows a wide range, with a median of 149 lines and a maximum of 4428 lines. This suggests variability in the scope of changes per commit.
- **Strengths**
  - Diverse commit sizes can indicate flexibility in handling both minor and major changes.
- **Needs improvement**
  - Large commits could be broken down for better traceability and review.
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
24  ███░░░░░░░░░  8
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
    - 24: 8
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 26

- **What it means** — Most commits occur during typical working hours, with a peak at 19:00 UTC. This suggests a concentrated effort during the day, with some activity extending into the evening.
- **Strengths**
  - Consistent work pattern during typical working hours.
- **Needs improvement** — —
- **Suggestions**
  - Ensure work-life balance by monitoring late evening activity.

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

- **What it means** — The repository has a total of 2 contributors, both of whom are active within the last 90 days. This indicates a small team size, which can lead to faster decision-making but may also pose risks if one contributor becomes unavailable.
- **Strengths**
  - Both contributors are active, indicating engagement.
- **Needs improvement**
  - The team size is small, which could lead to bottlenecks or risks if a contributor leaves.
- **Suggestions**
  - Consider recruiting additional contributors to diversify skills and reduce risk.

#### Contribution distribution  ▲ risk  **94.93/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.93 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.93% of commits and 99.38% of lines of code. This indicates a potential risk of knowledge concentration.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one individual, which can lead to knowledge silos.
- **Suggestions**
  - Encourage more balanced contributions by involving the second contributor in more areas of the codebase.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.93 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project is highly dependent on a single contributor. If this person were unavailable, it could significantly impact the project.
- **Strengths** — —
- **Needs improvement**
  - The bus factor is low, indicating a high risk of project disruption if the main contributor is unavailable.
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

- **What it means** — Both contributors are new within the last 90 days, with no departures in the last 180 days. This suggests recent growth in the team without losing any members.
- **Strengths**
  - No contributors have departed, indicating stability.
- **Needs improvement** — —
- **Suggestions**
  - Continue to support and integrate new contributors to maintain engagement and retention.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              █████████░░░  112
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/retrieve                   ████░░░░░░░░  45
src/render/html                ████░░░░░░░░  44
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
      - touchCount: 112
      - authorCount: 2
      - topAuthorSharePct: 89.29
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
      - touchCount: 44
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
    - commit-whisper-report.html
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
      - touchCount: 9
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

- **What it means** — The ownership by area metric shows that most directories and files are dominated by a single author, which can lead to knowledge silos and maintenance challenges.
- **Strengths** — —
- **Needs improvement**
  - High ownership concentration in specific areas, which can lead to maintenance challenges if the main author is unavailable.
- **Suggestions**
  - Encourage code reviews and pair programming to spread knowledge across the team.

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
  - Lack of co-authorship suggests limited collaboration on commits.
- **Suggestions**
  - Promote collaborative practices such as pair programming or code reviews to enhance teamwork.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **51.45/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 51.45 |
| commitCount | 138 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a mean subject length of 65.01 characters and no empty messages. Over half of the commits include a body, suggesting detailed documentation.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
  - Over half of the commits include a body, indicating thorough documentation.
- **Needs improvement** — —
- **Suggestions** — —

#### Conventional Commits adherence  ● ok  **81.88/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 113 |
| adherenceSharePct | 81.88 |
| subjectsConsidered | 138 |

- **What it means** — The repository shows strong adherence to the Conventional Commits standard, with 81.88% of commits following the convention. This helps maintain clarity and consistency in commit messages.
- **Strengths**
  - High adherence to Conventional Commits at 81.88%.
  - Diverse use of commit types such as 'feat', 'fix', and 'chore'.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Encourage team members to follow the Conventional Commits standard for all commits.
  - Provide training or resources on the benefits and usage of Conventional Commits.

#### Imperative-mood / style signal  ● ok  **97.83/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 138 |
| imperativeMoodSharePct | 97.83 |
| capitalizedSubjectSharePct | 23.91 |
| noTrailingPeriodSharePct | 99.28 |

- **What it means** — The use of imperative mood in commit messages is very high at 97.83%, which aligns with best practices for clear and actionable commit messages.
- **Strengths**
  - High use of imperative mood in commit messages.
  - Almost all messages avoid trailing periods, maintaining consistency.
- **Needs improvement**
  - Increase the percentage of capitalized subjects.
- **Suggestions**
  - Encourage capitalization of the first word in commit messages to improve readability and consistency.

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 138 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful context and information.
- **Strengths**
  - No low-information or empty commit messages.
  - All commit messages provide meaningful context.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.07/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.07 |
| commitCount | 138 |

- **What it means** — The issue reference rate is low at 5.07%, suggesting that commits are not frequently linked to specific issues or tickets.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue references to improve traceability.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to enhance traceability and context.

#### Revert / fixup / amend signal  ● ok  **0.72/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.72 |
| commitCount | 138 |

- **What it means** — The low churn of intent (0.72%) indicates minimal need for reverts or fixups, suggesting that commits are generally well-considered and stable.
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

#### Branch/merge topology summary  ● ok  **5.07/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 138 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.07 |
| regularCommitCount | 130 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with 138 total commits and 7 merge commits, making up 5.07% of the total. The low percentage of merge commits suggests that most changes are committed directly to the main branch rather than through feature branches.
- **Strengths**
  - Consistent use of a merge-based workflow.
- **Needs improvement**
  - High number of direct commits to the main branch.
- **Suggestions**
  - Encourage the use of feature branches to increase the number of merge commits, which can improve code review processes and maintain a cleaner commit history.

#### Merge vs. rebase tendency  ● ok  **5.07/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.07 |
| firstParentLinearityPct | 94.93 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a 5.07% merge share and 94.93% first-parent linearity. This indicates a preference for keeping a linear history, but merges are still used occasionally.
- **Strengths**
  - High first-parent linearity suggests a clean commit history.
- **Needs improvement**
  - Mixed tendency might lead to inconsistencies in the workflow.
- **Suggestions**
  - Establish clear guidelines on when to use merge versus rebase to maintain consistency in the workflow.

#### Direct-to-default-branch rate  ▲ risk  **89.86/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 124 |
| directToDefaultSharePct | 89.86 |
| viaMergeCount | 14 |
| mainlineCommitCount | 131 |
| totalCommits | 138 |

- **What it means** — A high percentage (89.86%) of commits are made directly to the default branch, indicating that most changes bypass feature branches and are committed directly.
- **Strengths** — —
- **Needs improvement**
  - High direct-to-default rate can lead to less thorough code reviews and potential integration issues.
- **Suggestions**
  - Promote the use of pull requests and feature branches to reduce direct commits to the default branch, enhancing code quality and collaboration.

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

- **What it means** — The average number of changes per merge is 60.71, with a median of 29 and a maximum of 234. This indicates variability in the size of changes being merged, but no merges without unique commits, suggesting effective use of branches for feature development.
- **Strengths**
  - All merges contain unique commits, indicating effective use of branches.
- **Needs improvement**
  - High variability in changes per merge could indicate inconsistent branch management.
- **Suggestions**
  - Encourage more frequent, smaller merges to maintain manageable change sizes and reduce integration complexity.

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
  - Investigate 'src/cli/interactive.ts' for potential refactoring to improve stability.

#### Churn rate over time  ● ok  `▅`

- **Value**
  - perMonth
    - 2026-06: 68687
  - totalChurn: 68687

- **What it means** — The 'Churn rate over time' metric indicates the volume of code changes. A churn of 68,687 lines in June 2026 suggests significant development activity, which could be due to new features or refactoring.
- **Strengths**
  - High development activity indicates a dynamic project environment.
- **Needs improvement**
  - Sustained high churn could indicate instability or frequent rework.
- **Suggestions**
  - Monitor churn trends to identify if high churn is a recurring issue.
  - Ensure adequate testing and code reviews to manage churn effectively.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  57665
totalDeletions  ██░░░░░░░░░░  11022
addDeleteRatio  ░░░░░░░░░░░░  5.23
netLines        ██████████░░  46643
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 57665 |
| totalDeletions | 11022 |
| addDeleteRatio | 5.23 |
| netLines | 46643 |

- **What it means** — The 'Add/delete ratio' of 5.23 indicates that for every line deleted, over five lines were added. This suggests a phase of expansion, possibly due to new features being added.
- **Strengths**
  - High addition rate suggests active feature development.
- **Needs improvement**
  - A high add/delete ratio can lead to code bloat if not managed.
- **Suggestions**
  - Regularly review and refactor code to maintain quality and manage growth.
  - Balance feature additions with necessary deletions to avoid unnecessary complexity.

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

- **What it means** — The 'File survival / age' metric shows a median file age of 1.2 days, indicating frequent updates. This suggests a highly dynamic codebase with rapid iterations.
- **Strengths**
  - Frequent updates can indicate responsiveness to change.
- **Needs improvement**
  - Short file age may suggest instability or frequent rework.
- **Suggestions**
  - Stabilize frequently changing files by improving initial design and testing.
  - Encourage thorough code reviews to reduce unnecessary changes.

#### Large-change events  ● ok  **13.04/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 18 |
| largeChangeSharePct | 13.04 |

- **What it means** — The 'Large-change events' metric shows 18 events with significant churn, indicating periods of intense development or refactoring. This can be a sign of major updates or restructuring.
- **Strengths**
  - Large changes can indicate significant progress or improvements.
- **Needs improvement**
  - Frequent large changes can disrupt stability and increase risk.
- **Suggestions**
  - Plan large changes carefully to minimize disruption.
  - Ensure comprehensive testing around large change events to maintain stability.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  90.94
Commit Size Discipline  ██████████░░  78
```

#### Overall hygiene score  ◐ watch  **55.8/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 55.8 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score is 55.8, indicating moderate code hygiene. The score is a weighted average of several components. Message Quality is strong, but Branching Discipline and Collaboration Breadth are notably weak, pulling down the overall score.
- **Strengths**
  - High Message Quality with a subScore of 90.94, indicating clear and informative commit messages.
- **Needs improvement**
  - Branching Discipline with a subScore of 10.14, suggesting poor branching practices.
  - Collaboration Breadth with a subScore of 5.07, indicating limited collaboration across the team.
- **Suggestions**
  - Improve branching practices by adopting a more structured branching strategy.
  - Encourage broader collaboration by involving more team members in code reviews and contributions.

#### Bus-factor risk flag  ▲ risk  **94.93/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.93 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, meaning the project heavily relies on a single contributor who holds 94.93% of the knowledge. This poses a significant risk if that contributor becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - High concentration of knowledge in one contributor, increasing project risk.
- **Suggestions**
  - Distribute knowledge by encouraging code reviews and pair programming.
  - Document key processes and code areas to reduce reliance on a single contributor.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  90.94
Commit Size Discipline  ██████████░░  78
```

- **Value**
  - strengths
    - Message Quality: 90.94
    - Commit Size Discipline: 78
  - weaknesses
    - Collaboration Breadth: 5.07
    - Branching Discipline: 10.14

- **What it means** — The strengths and weaknesses highlight areas of high and low performance. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - Strong Message Quality and Commit Size Discipline, indicating good commit practices.
- **Needs improvement**
  - Collaboration Breadth and Branching Discipline need significant improvement.
- **Suggestions**
  - Focus on improving collaboration by involving more team members in the development process.
  - Enhance branching practices to ensure better code management and integration.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:51:19.931Z
