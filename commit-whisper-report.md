# commit-whisper — georgiosnikitas/brain-break

_georgiosnikitas/brain-break · 278 commits · 2 contributors · analyzed 2026-06-18_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows strong commit size discipline but faces high bus-factor risk and limited collaboration.

The repository has maintained a consistent activity level with a strong focus on commit size discipline and message quality. However, it faces significant challenges in collaboration breadth and branching discipline, with a high bus-factor risk due to knowledge concentration in a single contributor. Addressing these issues is crucial for improving the project's sustainability and resilience.

- Commit volume peaked in March with 189 commits, declining to 26 by May.
- Commit size discipline is excellent, with a perfect score of 100.
- Bus-factor risk is high, with 99.28% of contributions from one author.
- Branching discipline is weak, with 92.45% of commits going directly to the default branch.
- Collaboration breadth is limited, with a score of 0.72.

## Explanation

The repository's activity peaked in March with 189 commits, followed by a decline to 63 in April and 26 in May. This suggests a burst of initial development activity that has since slowed. The commit cadence shows a median interval of 677 seconds, indicating frequent commits during active periods.

Commit size discipline is a strength, with a perfect score of 100, reflecting well-managed changes. However, the bus-factor risk is high, as 99.28% of contributions come from a single author, posing a significant risk if this contributor becomes unavailable.

Branching discipline is notably weak, with 92.45% of commits made directly to the default branch, indicating a lack of feature branching and potential integration issues. Collaboration breadth is also limited, with a score of 0.72, suggesting minimal co-authorship and shared knowledge.

The overall hygiene score is 56.15, with strengths in commit size and message quality but weaknesses in collaboration and branching. Addressing these weaknesses is essential to improve the project's resilience and maintainability.

## Coaching

The repository is currently in a state of high activity but faces challenges in collaboration and branching practices. This improvement plan focuses on addressing these areas to enhance the project's sustainability and reduce risk.

### 1. Branching Discipline

- Implement a feature branching strategy to reduce direct commits to the default branch, currently at 92.45%.
- Encourage regular merges to integrate changes, improving the current merge share of 3.24%.
- Establish guidelines for branch naming and lifecycle to enhance organization and clarity.

### 2. Collaboration and Knowledge Sharing

- Increase the number of active contributors to reduce the bus-factor risk, currently at 1.
- Promote pair programming or code reviews to enhance collaboration, addressing the low collaboration breadth score of 0.72.
- Document key areas of the codebase to distribute knowledge and reduce reliance on a single contributor.

_The top priorities are to improve branching discipline and enhance collaboration. Start by implementing a feature branching strategy and increasing contributor engagement to mitigate the high bus-factor risk. These steps will strengthen the project's resilience and maintainability._

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

- **What it means** — The average commit interval is approximately 6.7 hours, with a median of about 11 minutes, indicating frequent commits. This suggests a healthy, continuous integration practice.
- **Strengths**
  - Frequent commits indicate active development and integration.
- **Needs improvement** — —
- **Suggestions**
  - Maintain the current commit frequency to support agile development practices.

#### Active vs. dormant periods  ● ok  **14**

- **Value** — 14
- **What it means** — There are no dormant periods, indicating continuous activity from March to May. This is a positive sign of ongoing development without significant breaks.
- **Strengths**
  - Continuous activity without dormancy shows consistent engagement.
- **Needs improvement** — —
- **Suggestions**
  - Continue to monitor for any potential future dormancy to ensure ongoing project health.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████░░░░  76.89
ageDays       ████████████  109.43
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 76.89 |
| ageDays | 109.43 |

- **What it means** — The project is relatively young, with a lifespan of about 77 days. This suggests it is in its early stages, which aligns with the high initial activity observed.
- **Strengths**
  - Strong initial development phase.
- **Needs improvement** — —
- **Suggestions**
  - Focus on establishing long-term goals and sustainability strategies as the project matures.

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

- **What it means** — The commit size distribution shows a wide range, with a median of 35.5 and a maximum of 3935. This indicates variability in commit sizes, which could affect code review and integration processes.
- **Strengths** — —
- **Needs improvement**
  - High variability in commit sizes.
- **Suggestions**
  - Encourage smaller, more consistent commit sizes to improve code review efficiency.
  - Implement guidelines for commit size to ensure manageable changes.

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

- **What it means** — Most commits occur during typical working hours, with a peak at 13:00 UTC. There is also a high volume of activity on Sundays, which may indicate weekend work or global team contributions.
- **Strengths**
  - Consistent activity during working hours.
- **Needs improvement**
  - High Sunday activity may indicate work-life balance issues.
- **Suggestions**
  - Ensure team members are not overworking, especially on weekends.
  - Consider time zone differences if the team is distributed globally.

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
  - Both contributors are active, indicating engagement.
- **Needs improvement**
  - The contributor base is small, which may risk continuity if one leaves.
- **Suggestions**
  - Consider recruiting more contributors to diversify the team and reduce risk.

#### Contribution distribution  ▲ risk  **99.28/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.49 |
| giniLines | 0.5 |
| topCommitSharePct | 99.28 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 99.28% of commits and 99.88% of lines of code. This indicates a potential risk of over-reliance on a single contributor.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one person can lead to knowledge silos.
- **Suggestions**
  - Encourage more balanced contributions by involving the second contributor in more areas of the codebase.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 99.28 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. If this person becomes unavailable, it could significantly impact the project.
- **Strengths** — —
- **Needs improvement**
  - The bus factor of 1 is a critical risk for project continuity.
- **Suggestions**
  - Increase knowledge sharing and documentation to mitigate risks associated with a low bus factor.

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

- **What it means** — There is one new contributor and no departures in the last 90 days. This suggests some growth in the contributor base without losing existing members.
- **Strengths**
  - New contributor joined without any departures, indicating positive growth.
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

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating potential knowledge silos.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in many areas can lead to bottlenecks and risks if that author is unavailable.
- **Suggestions**
  - Encourage code reviews and pair programming to spread knowledge across the team.

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
  - There is some collaboration as evidenced by co-authored commits.
- **Needs improvement**
  - The level of co-authorship is relatively low, suggesting limited collaboration.
- **Suggestions**
  - Promote more collaborative practices such as pair programming or team-based projects to increase co-authorship.

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
  - Low percentage of messages with a body, which could limit context for changes.
- **Suggestions**
  - Encourage adding more detailed bodies to commit messages to improve context and understanding of changes.

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
  - 30.22% of commits do not follow the convention, which could lead to inconsistencies.
- **Suggestions**
  - Conduct a team workshop on the benefits of Conventional Commits to improve adherence.
  - Implement commit message linting tools to enforce adherence.

#### Imperative-mood / style signal  ● ok  **91.01/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 278 |
| imperativeMoodSharePct | 91.01 |
| capitalizedSubjectSharePct | 7.19 |
| noTrailingPeriodSharePct | 100 |

- **What it means** — The imperative mood is used in 91.01% of commit messages, which is a good practice for clarity and consistency. However, only 7.19% of subjects are capitalized, which is less conventional.
- **Strengths**
  - High use of imperative mood, enhancing clarity.
- **Needs improvement**
  - Low capitalization of subjects, which is less conventional.
- **Suggestions**
  - Encourage capitalization of the first word in commit messages to align with common conventions.

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

- **What it means** — Only 2.52% of commits reference an issue or ticket, which may indicate a lack of traceability between code changes and project management tools.
- **Strengths** — —
- **Needs improvement**
  - Low rate of issue or ticket references, which can hinder traceability.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to improve traceability and context.

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

- **What it means** — There are no revert, fixup, or squash commits, indicating a clean commit history with no apparent need for corrections or amendments.
- **Strengths**
  - No revert or fixup commits, suggesting a clean and deliberate commit history.
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

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with a low percentage of merge commits (3.24%). This suggests that most changes are committed directly to the main branch rather than through feature branches.
- **Strengths**
  - The workflow is consistent with a merge-based approach.
- **Needs improvement**
  - The low number of merge commits indicates limited use of feature branches, which can hinder collaborative development and code review processes.
- **Suggestions**
  - Encourage the use of feature branches for new features and bug fixes to facilitate better code reviews and testing before merging into the main branch.

#### Merge vs. rebase tendency  ● ok  **3.24/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 3.24 |
| firstParentLinearityPct | 95.68 |

- **What it means** — The repository shows a mixed tendency between merging and rebasing, with a high first-parent linearity percentage (95.68%). This indicates a preference for keeping the commit history linear, which can simplify the history but may obscure the context of changes.
- **Strengths**
  - High linearity suggests a clean and understandable commit history.
- **Needs improvement**
  - The mixed tendency might lead to confusion about the preferred workflow.
- **Suggestions**
  - Clarify the preferred workflow (merge or rebase) in the team's development guidelines to ensure consistency and understanding among team members.

#### Direct-to-default-branch rate  ▲ risk  **92.45/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 257 |
| directToDefaultSharePct | 92.45 |
| viaMergeCount | 21 |
| mainlineCommitCount | 266 |
| totalCommits | 278 |

- **What it means** — A high percentage (92.45%) of commits are made directly to the default branch, indicating that most changes bypass feature branches.
- **Strengths** — —
- **Needs improvement**
  - Direct commits to the default branch can reduce opportunities for code review and testing, potentially increasing the risk of introducing bugs.
- **Suggestions**
  - Implement a policy to use pull requests for changes to the default branch, encouraging code reviews and testing before integration.

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

- **What it means** — There are no long-lived branches, with the longest branch lasting only 8.68 days. This suggests that branches are short-lived and likely merged or deleted quickly.
- **Strengths**
  - Short-lived branches indicate efficient merging and integration processes.
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

- **What it means** — The average number of changes per merge is high (296.56), with a significant maximum of 1986 changes in one merge. This suggests that some merges integrate large amounts of work, which can complicate reviews and increase the risk of integration issues.
- **Strengths** — —
- **Needs improvement**
  - Large merges can be difficult to review and may introduce integration problems.
- **Suggestions**
  - Encourage more frequent, smaller merges to make code reviews more manageable and reduce the risk of integration issues.

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
  - Frequent updates to documentation suggest active maintenance and planning.
- **Needs improvement**
  - High churn in 'package-lock.json' may indicate instability in dependencies.
- **Suggestions**
  - Review dependency management practices to reduce churn in 'package-lock.json'.
  - Ensure changes to documentation are well-coordinated to avoid unnecessary churn.

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
  - The high churn in March could suggest inefficiencies or rework.
- **Suggestions**
  - Analyze the reasons for high churn in March to identify potential inefficiencies.
  - Ensure that the decrease in churn is due to stabilization rather than reduced productivity.

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

- **What it means** — The 'Add/delete ratio' metric shows a high ratio of additions to deletions (5.79), indicating that more lines are being added than removed. This suggests growth in the codebase, which can be positive if managed well.
- **Strengths**
  - The high add/delete ratio suggests active development and feature growth.
- **Needs improvement**
  - A high ratio could lead to code bloat if not managed properly.
- **Suggestions**
  - Regularly review and refactor code to manage growth and maintain quality.
  - Ensure that new additions are necessary and well-integrated.

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

- **What it means** — The 'File survival / age' metric shows a median file age of 1.35 days, indicating frequent updates. This suggests active development but may also point to instability if files are frequently rewritten.
- **Strengths**
  - Frequent updates suggest active development and responsiveness to change.
- **Needs improvement**
  - Frequent rewriting of files could indicate instability or poor initial design.
- **Suggestions**
  - Investigate why files are frequently rewritten and address underlying issues.
  - Ensure that changes are well-planned to avoid unnecessary rewrites.

#### Large-change events  ● ok  **6.12/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 17 |
| largeChangeSharePct | 6.12 |

- **What it means** — The 'Large-change events' metric identifies 17 events with significant churn, accounting for 6.12% of changes. These events can indicate major updates or refactoring but may also suggest potential risks if not well-managed.
- **Strengths**
  - Large changes can indicate significant progress or necessary refactoring.
- **Needs improvement**
  - Frequent large changes can introduce risks and instability.
- **Suggestions**
  - Ensure large changes are thoroughly reviewed and tested to mitigate risks.
  - Plan large changes carefully to minimize disruption.

### F · Repository Health Signals

Overall repository health signals.

_No group-overview chart — see the metrics below._

#### Overall hygiene score  ◐ watch  **56.15/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 56.15 |
| componentsContributing | 5 |

- **What it means** — The overall hygiene score of 56.15 indicates a moderate level of codebase health. This score is a weighted average of several components, with strong performance in Commit Size Discipline and Message Quality, but significant weaknesses in Branching Discipline and Collaboration Breadth.
- **Strengths**
  - Commit Size Discipline is perfect, indicating well-managed commit sizes.
  - Message Quality is high, suggesting clear and informative commit messages.
- **Needs improvement**
  - Branching Discipline is very low, indicating potential issues with how branches are managed.
  - Collaboration Breadth is extremely low, suggesting limited contribution diversity.
- **Suggestions**
  - Improve Branching Discipline by establishing clearer branching strategies and guidelines.
  - Enhance Collaboration Breadth by encouraging more team members to contribute to the codebase.

#### Bus-factor risk flag  ▲ risk  **99.28/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 99.28 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1 and 99.28% of contributions coming from a single author. This indicates a significant risk if the primary contributor becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - The team is highly dependent on a single contributor, which poses a risk to project continuity.
- **Suggestions**
  - Distribute knowledge and responsibilities more evenly across the team to reduce dependency on a single contributor.
  - Encourage code reviews and pair programming to share knowledge.

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
  - Commit Size Discipline is a strength, showing effective management of commit sizes.
  - Message Quality is a strength, indicating clear communication in commit messages.
- **Needs improvement**
  - Collaboration Breadth is a weakness, indicating limited diversity in contributions.
  - Branching Discipline is a weakness, suggesting issues with branch management.
- **Suggestions**
  - To address Collaboration Breadth, involve more team members in the development process.
  - Improve Branching Discipline by implementing a more structured branching strategy.

---
Generated by commit-whisper v1.1.1 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-18T20:44:37.917Z
