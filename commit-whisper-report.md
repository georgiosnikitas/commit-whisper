# commit-whisper — commit-whisper

_commit-whisper · 132 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and limited collaboration.

The repository has experienced a burst of activity over a short period, with a high volume of commits and adherence to conventional commit standards. However, the project is heavily reliant on a single contributor, posing a high bus-factor risk. Additionally, the lack of collaboration and branching discipline are notable weaknesses that need addressing to ensure long-term sustainability and team resilience.

- Commit volume peaked with 132 commits in June, indicating high activity.
- The bus-factor is 1, with 94.7% of contributions from one author, posing a high risk.
- Collaboration is minimal, with no co-authored commits and a low collaboration score of 5.3.
- Branching discipline is weak, with 89.39% of commits going directly to the default branch.
- Commit messages are strong, with 82.58% adherence to conventional standards.

## Explanation

The repository has shown a high level of activity, with 132 commits in June and a peak of 32 commits on multiple days. This indicates a concentrated effort over a short period, likely driven by a small team of two contributors. The average commit interval of 8163.3 seconds suggests frequent updates, although the median interval of 723 seconds points to bursts of activity.

A significant concern is the bus-factor of 1, meaning the project heavily relies on one contributor who is responsible for 94.7% of commits. This concentration of knowledge poses a risk to project continuity if this contributor becomes unavailable.

Collaboration within the team is minimal, as evidenced by the absence of co-authored commits and a low collaboration score of 5.3. This lack of collaboration could hinder knowledge sharing and team resilience.

Branching practices are another area of concern, with 89.39% of commits made directly to the default branch. This indicates a lack of branching discipline, which can complicate code management and integration.

Despite these challenges, the repository excels in commit message quality, with 82.58% adherence to conventional commit standards and a high message quality score of 91.29. This suggests clear and informative commit documentation.

## Coaching

The repository is currently active but faces risks due to knowledge concentration and limited collaboration. This improvement plan addresses these issues to enhance sustainability and team resilience.

### 1. Knowledge Distribution

- Encourage knowledge sharing by involving more contributors in key areas, reducing the bus-factor risk from 1.
- Implement pair programming or code reviews to distribute knowledge and reduce reliance on a single contributor.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging team members to work together on commits, aiming to increase the collaboration score from 5.3.
- Introduce regular team meetings to discuss ongoing work and share insights, fostering a collaborative environment.

### 3. Branching Discipline

- Adopt a branching strategy that reduces direct commits to the default branch, currently at 89.39%, to improve code management.
- Train the team on effective branching practices, such as feature branches, to enhance the branching discipline score from 10.61.

_Top priorities include reducing the bus-factor risk by distributing knowledge and improving collaboration through co-authorship and team interactions. Enhancing branching discipline will also be crucial for maintaining code quality and project sustainability._

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
```

#### Commit volume over time  ● ok  `▁▁▁▁▅▅█▁▆█`

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

- **What it means** — The commit volume shows a significant increase over the analyzed period, with a peak of 32 commits on two separate days. This suggests a period of intense development activity, particularly in the last week of the analysis.
- **Strengths**
  - High productivity in the last week, indicating effective team collaboration or a push to meet a deadline.
- **Needs improvement** — —
- **Suggestions**
  - Maintain this level of productivity by ensuring team members are not overworked, possibly by distributing workload evenly.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  8163.3
medianIntervalSeconds   █░░░░░░░░░░░  723
intervalCount           ░░░░░░░░░░░░  131
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 8163.3 |
| medianIntervalSeconds | 723 |
| intervalCount | 131 |

- **What it means** — The average interval between commits is approximately 8163 seconds (about 2.27 hours), with a median of 723 seconds (about 12 minutes). This indicates frequent commits, suggesting active development and possibly good practices in committing changes regularly.
- **Strengths**
  - Frequent commits indicate active development and possibly good version control practices.
- **Needs improvement** — —
- **Suggestions**
  - Encourage the continuation of frequent commits to maintain active development and quick iterations.

#### Active vs. dormant periods  ● ok  **14**

- **Value** — 14
- **What it means** — There are no dormant periods detected, indicating continuous activity throughout the analyzed timeframe. This suggests a consistent development effort without significant breaks.
- **Strengths**
  - Continuous activity with no dormant periods, indicating sustained development effort.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that the team maintains a healthy work-life balance to sustain this level of activity.

#### Project age & lifespan  ● ok

```
lifespanDays  ██████████░░  12.38
ageDays       ████████████  14.47
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 12.38 |
| ageDays | 14.47 |

- **What it means** — The project is relatively new, with a lifespan of just over 12 days. This suggests that the repository is in its early stages of development.
- **Strengths**
  - Rapid development in the early stages of the project.
- **Needs improvement** — —
- **Suggestions**
  - Focus on establishing strong foundational code and documentation to support future development.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  120
p90          ███░░░░░░░░░  1168.4
max          ████████████  4428
mean         █░░░░░░░░░░░  462.26
commitCount  ░░░░░░░░░░░░  132
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 120 |
| p90 | 1168.4 |
| max | 4428 |
| mean | 462.26 |
| commitCount | 132 |

- **What it means** — The commit size distribution shows a wide range, with a median size of 120 lines and a maximum of 4428 lines. This suggests variability in the scope of changes being committed, which could be due to different types of tasks being undertaken.
- **Strengths**
  - Diverse commit sizes may indicate flexibility in handling both small fixes and large features.
- **Needs improvement**
  - Large commits could be broken down into smaller, more manageable pieces to improve reviewability.
- **Suggestions**
  - Encourage breaking down large changes into smaller commits to facilitate easier code reviews and integration.

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
24  █░░░░░░░░░░░  2
```

- **Value**

| Item | Value |
| --- | --- |
| 1 | 0 |
| 2 | 0 |
| 3 | 0 |
| 4 | 0 |
| 5 | 2 |
| 6 | 2 |
| 7 | 3 |
| 8 | 3 |
| 9 | 3 |
| 10 | 3 |
| 11 | 4 |
| 12 | 5 |
| 13 | 3 |
| 14 | 4 |
| 15 | 1 |
| 16 | 7 |
| 17 | 7 |
| 18 | 10 |
| 19 | 9 |
| 20 | 34 |
| 21 | 28 |
| 22 | 2 |
| 23 | 0 |
| 24 | 2 |

- **What it means** — Most commits occur between 19:00 and 21:00 UTC, with a peak on Wednesday. This pattern suggests that the team may be working late hours or aligning with specific time zones.
- **Strengths**
  - Consistent peak activity times may indicate effective scheduling or time zone alignment.
- **Needs improvement**
  - Late working hours could lead to burnout if not managed properly.
- **Suggestions**
  - Consider adjusting work schedules to ensure team members are not consistently working late hours, promoting a healthier work-life balance.

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

- **What it means** — The repository has a total of 2 contributors, both of whom are active within the last 90 days. This indicates a small team size, which can lead to faster decision-making but may also pose risks if contributors leave.
- **Strengths**
  - All contributors are active, indicating engagement.
- **Needs improvement**
  - The contributor base is small, which can be risky for project continuity.
- **Suggestions**
  - Consider recruiting more contributors to diversify the team and reduce risk.

#### Contribution distribution  ▲ risk  **94.7/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.7 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.7% of commits and 99.3% of lines of code. This indicates a potential risk of knowledge concentration.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by a single contributor.
- **Suggestions**
  - Encourage more balanced contributions by mentoring and involving the second contributor in more areas of the project.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.7 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. This is a significant risk as the project could be severely impacted if this contributor becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - The project is highly dependent on one contributor.
- **Suggestions**
  - Increase knowledge sharing and documentation to mitigate risks associated with a low bus factor.
  - Encourage the second contributor to take on more responsibilities.

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

- **What it means** — Both contributors are new within the last 90 days, with no departures in the last 180 days. This suggests recent growth in the team but also highlights the need for effective onboarding.
- **Strengths**
  - No contributors have departed recently, indicating stability.
- **Needs improvement** — —
- **Suggestions**
  - Ensure robust onboarding processes to integrate new contributors effectively.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              ████████░░░░  100
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/retrieve                   ████░░░░░░░░  45
src/analyze                    ███░░░░░░░░░  37
src/license                    ███░░░░░░░░░  35
src/render/html                ██░░░░░░░░░░  31
src/assemble                   ██░░░░░░░░░░  23
```

- **Value**

| Item | Value |
| --- | --- |
| src/cli | 150 |
| docs/implementation-artifacts | 137 |
| . | 100 |
| src/narrate | 61 |
| src/config | 53 |
| src/retrieve | 45 |
| src/analyze | 37 |
| src/license | 35 |
| src/render/html | 31 |
| src/assemble | 23 |

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating a lack of shared ownership and potential bottlenecks in knowledge.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in most areas, which can lead to bottlenecks.
- **Suggestions**
  - Promote pair programming or code reviews to increase shared ownership.
  - Encourage contributors to work across different areas to balance expertise.

#### Co-authorship / collaboration signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 0 |
| coAuthoredSharePct | 0 |
| totalCoAuthorTrailers | 0 |
| distinctCoAuthors | 0 |

- **What it means** — There are no commits with co-authors, indicating a lack of collaboration in the form of co-authored commits. This might suggest isolated work practices.
- **Strengths** — —
- **Needs improvement**
  - Lack of co-authored commits suggests limited collaboration.
- **Suggestions**
  - Encourage collaborative practices such as pair programming or joint problem-solving sessions.
  - Introduce tools or practices that facilitate co-authorship, like shared coding sessions.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **49.24/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 49.24 |
| commitCount | 132 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a mean subject length of 65.03 characters and no empty messages. Nearly half of the commits include a body, suggesting detailed documentation.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
- **Needs improvement**
  - Increase the percentage of commits with a body to provide more context.
- **Suggestions**
  - Encourage developers to add more detailed bodies to commit messages, especially for complex changes.

#### Conventional Commits adherence  ● ok  **82.58/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 109 |
| adherenceSharePct | 82.58 |
| subjectsConsidered | 132 |

- **What it means** — The repository shows strong adherence to the Conventional Commits standard, with 82.58% of commits following the convention. This helps maintain clarity and consistency in commit messages.
- **Strengths**
  - High adherence to Conventional Commits, enhancing clarity and organization.
- **Needs improvement**
  - Increase adherence to reach closer to 100%.
- **Suggestions**
  - Conduct a team review of the Conventional Commits guidelines to ensure full understanding and compliance.

#### Imperative-mood / style signal  ● ok  **97.73/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 132 |
| imperativeMoodSharePct | 97.73 |
| capitalizedSubjectSharePct | 23.48 |
| noTrailingPeriodSharePct | 99.24 |

- **What it means** — The imperative mood is used in 97.73% of commit messages, which is excellent for maintaining a consistent and action-oriented style. Most subjects are not capitalized, aligning with common style guides.
- **Strengths**
  - High use of imperative mood, promoting clarity and consistency.
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
| commitCount | 132 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information. This is a strong indicator of good communication practices.
- **Strengths**
  - All commit messages are informative, with no low-information or empty messages.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.3/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.3 |
| commitCount | 132 |

- **What it means** — Only 5.3% of commits reference issues or tickets, which is relatively low. This may indicate a lack of traceability between commits and project management tools.
- **Strengths** — —
- **Needs improvement**
  - Increase the rate of issue or ticket references to improve traceability.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to enhance project tracking and accountability.

#### Revert / fixup / amend signal  ● ok  **0.76/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.76 |
| commitCount | 132 |

- **What it means** — The low churn of intent (0.76%) suggests that commits are generally well-planned and executed, with minimal need for reverts or fixups.
- **Strengths**
  - Low rate of reverts and fixups, indicating well-considered commits.
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

#### Branch/merge topology summary  ● ok  **5.3/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 132 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.3 |
| regularCommitCount | 124 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with 132 total commits and 7 merge commits, making up 5.3% of the total. The low number of merge commits suggests that most changes are committed directly to the main branch rather than through feature branches.
- **Strengths**
  - Consistent use of a merge-based workflow.
- **Needs improvement**
  - Low percentage of merge commits indicates limited use of feature branches.
- **Suggestions**
  - Encourage the use of feature branches for new features or bug fixes to improve code review and testing processes.

#### Merge vs. rebase tendency  ● ok  **5.3/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.3 |
| firstParentLinearityPct | 94.7 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a 5.3% merge share and 94.7% first-parent linearity. This suggests a preference for keeping a linear history, but merges are still used occasionally.
- **Strengths**
  - High first-parent linearity indicates a clean and understandable commit history.
- **Needs improvement**
  - Mixed tendency might lead to confusion if team members are not aligned on when to use merge vs. rebase.
- **Suggestions**
  - Establish clear guidelines on when to use merge versus rebase to maintain consistency in the commit history.

#### Direct-to-default-branch rate  ▲ risk  **89.39/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 118 |
| directToDefaultSharePct | 89.39 |
| viaMergeCount | 14 |
| mainlineCommitCount | 125 |
| totalCommits | 132 |

- **What it means** — A high percentage (89.39%) of commits are made directly to the default branch, indicating that most changes bypass feature branches. This can speed up development but may reduce opportunities for code review and testing.
- **Strengths** — —
- **Needs improvement**
  - High direct-to-default rate suggests limited use of feature branches, which can impact code quality.
- **Suggestions**
  - Implement a policy to encourage more changes through feature branches to enhance code quality and collaboration.

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

- **What it means** — There are no long-lived branches in the repository, with the longest branch lasting only 0.01 days. This indicates that branches are either merged quickly or not used extensively.
- **Strengths**
  - Quick merging of branches suggests efficient integration of changes.
- **Needs improvement**
  - Lack of long-lived branches might indicate insufficient use of feature branches for larger tasks.
- **Suggestions**
  - Consider using feature branches for larger tasks that require more time and collaboration before merging.

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

- **What it means** — The average number of changes per merge is 60.71, with a median of 29 and a maximum of 234. This suggests that merges are generally manageable in size, but there are occasional large merges.
- **Strengths**
  - Merges are generally of a manageable size, facilitating easier reviews.
- **Needs improvement**
  - Occasional large merges could complicate code reviews and integration.
- **Suggestions**
  - Encourage more frequent, smaller merges to maintain manageable review sizes and reduce integration complexity.

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

- **What it means** — This metric identifies the files and directories with the highest frequency of changes. High touch counts and churn in files like `package-lock.json` and `src/cli/interactive.ts` suggest these areas are frequently updated, possibly indicating active development or instability.
- **Strengths**
  - Active development in `src/cli` indicates ongoing improvements.
- **Needs improvement**
  - High churn in `package-lock.json` suggests potential dependency management issues.
- **Suggestions**
  - Review dependency management practices to reduce churn in `package-lock.json`.
  - Consider refactoring `src/cli/interactive.ts` to improve stability.

#### Churn rate over time  ● ok

- **Value**
  - perMonth
    - 2026-06: 61018
  - totalChurn: 61018

- **What it means** — The churn rate over time shows a high level of code changes in June 2026, with significant additions and deletions. This indicates a period of intense development or refactoring.
- **Strengths**
  - High commit count suggests active development.
- **Needs improvement**
  - High churn may indicate instability or frequent rework.
- **Suggestions**
  - Analyze the reasons for high churn to identify areas for process improvement.
  - Ensure adequate testing to maintain stability during high churn periods.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  52437
totalDeletions  ██░░░░░░░░░░  8581
addDeleteRatio  ░░░░░░░░░░░░  6.11
netLines        ██████████░░  43856
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 52437 |
| totalDeletions | 8581 |
| addDeleteRatio | 6.11 |
| netLines | 43856 |

- **What it means** — The add/delete ratio of 6.11 indicates that for every line deleted, over six lines were added. This suggests a period of expansion or new feature development.
- **Strengths**
  - High ratio suggests growth and new feature additions.
- **Needs improvement** — —
- **Suggestions**
  - Monitor for potential code bloat and ensure new code is well-documented and tested.

#### File survival / age  ● ok

```
medianAgeDays         ░░░░░░░░░░░░  1.17
maxAgeDays            ░░░░░░░░░░░░  9.23
filesConsidered       ████████████  262
singleTouchFileCount  ███░░░░░░░░░  64
```

- **Value**

| Item | Value |
| --- | --- |
| medianAgeDays | 1.17 |
| maxAgeDays | 9.23 |
| filesConsidered | 262 |
| singleTouchFileCount | 64 |

- **What it means** — The median file age of 1.17 days indicates that files are frequently updated, which may suggest rapid development cycles or instability.
- **Strengths**
  - Frequent updates can indicate active maintenance.
- **Needs improvement**
  - Short file age may suggest instability or frequent rework.
- **Suggestions**
  - Evaluate if frequent updates are due to necessary improvements or if they indicate underlying issues.
  - Consider strategies to increase code stability.

#### Large-change events  ● ok  **11.36/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 15 |
| largeChangeSharePct | 11.36 |

- **What it means** — There were 15 large-change events, accounting for 11.36% of changes. This suggests occasional significant updates, which could be planned releases or major refactoring efforts.
- **Strengths**
  - Large changes can indicate significant feature releases or improvements.
- **Needs improvement**
  - Frequent large changes may disrupt stability.
- **Suggestions**
  - Plan large changes carefully to minimize disruption.
  - Ensure thorough testing and review processes for large changes.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  91.29
Commit Size Discipline  ███████████░  84.44
```

#### Overall hygiene score  ◐ watch  **57.51/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 57.51 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 57.51 indicates a moderate level of codebase health. The score is a weighted average of several components, with Message Quality and Commit Size Discipline contributing positively. However, low scores in Branching Discipline and Collaboration Breadth significantly lower the overall score.
- **Strengths**
  - High Message Quality
  - Good Commit Size Discipline
- **Needs improvement**
  - Branching Discipline
  - Collaboration Breadth
- **Suggestions**
  - Improve branching strategies to increase Branching Discipline score.
  - Encourage broader collaboration to enhance Collaboration Breadth.

#### Bus-factor risk flag  ▲ risk  **94.7/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.7 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, meaning that a single person holds 94.7% of the knowledge. This poses a significant risk to the team's ability to maintain the project if that person becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - Reduce knowledge concentration among team members.
- **Suggestions**
  - Encourage knowledge sharing and documentation to reduce reliance on a single contributor.
  - Pair programming and code reviews can help distribute knowledge more evenly.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  91.29
Commit Size Discipline  ███████████░  84.44
```

- **Value**

| Item | Value |
| --- | --- |
| Message Quality | 91.29 |
| Commit Size Discipline | 84.44 |

- **What it means** — The strengths and weaknesses highlight areas of high and low performance. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - High Message Quality
  - Good Commit Size Discipline
- **Needs improvement**
  - Collaboration Breadth
  - Branching Discipline
- **Suggestions**
  - Focus on improving team collaboration and branching strategies to address weaknesses.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:16:59.313Z
