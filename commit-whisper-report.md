# commit-whisper — commit-whisper

_commit-whisper · 137 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and weak collaboration.

The repository has experienced a burst of activity over a short period, with a high volume of commits and a strong adherence to conventional commit standards. However, the project is heavily reliant on a single contributor, posing a high bus-factor risk. Additionally, the collaboration breadth and branching discipline are notably weak, indicating potential challenges in team scalability and code management.

- Commit volume is high with 137 commits in June, indicating active development.
- The bus-factor is 1, with 94.89% of contributions from one author, posing a high risk.
- Collaboration breadth is low, with no co-authored commits.
- Branching discipline is weak, with 89.78% of commits going directly to the default branch.
- Commit messages are generally high quality, with 81.75% adherence to conventional standards.

## Explanation

The repository has seen a significant amount of activity in a short span, with 137 commits in June alone. This indicates a period of intense development. The commit frequency shows a median interval of 699 seconds between commits, suggesting rapid iterations.

Despite the high activity, the project is at risk due to a high concentration of knowledge. The bus-factor is 1, meaning that one contributor is responsible for 94.89% of the commits. This creates a vulnerability if that contributor becomes unavailable.

Collaboration is minimal, as evidenced by the absence of co-authored commits. This lack of collaboration breadth could hinder knowledge sharing and team growth.

Branching discipline is another area of concern. With 89.78% of commits going directly to the default branch, there is a risk of integration issues and reduced code review opportunities.

On a positive note, the commit messages are well-structured, with 81.75% adhering to conventional commit standards, which aids in maintaining a clear project history.

## Coaching

The repository is currently experiencing a high level of activity but is at risk due to a concentration of knowledge and weak collaboration practices. This improvement plan addresses these issues to enhance team resilience and code management.

### 1. Knowledge Distribution

- Encourage more contributors to engage with the codebase to reduce the bus-factor risk. This can be achieved by pairing sessions or code reviews.
- Document key areas of the codebase thoroughly to ensure knowledge is shared and accessible to all team members.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging pair programming or collaborative coding sessions.
- Implement regular team meetings to discuss ongoing work and share insights, fostering a collaborative environment.

### 3. Branching Discipline

- Adopt a branching strategy such as Git Flow to improve code management and review processes.
- Encourage the use of feature branches for new developments to facilitate better integration and testing.

_The top priorities are to reduce the bus-factor risk by distributing knowledge more evenly across the team and to improve collaboration through co-authorship and regular team interactions. Enhancing branching discipline will also be crucial for maintaining code quality and facilitating smoother integrations._

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
2026-06-20  ██░░░░░░░░░░  5
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
| 2026-06-20 | 5 |

- **What it means** — The commit volume shows a significant increase over the analyzed period, with a peak in activity during the third week of June 2026. This suggests a period of intense development or a push to meet a deadline.
- **Strengths**
  - High activity in the third week indicates strong team engagement.
- **Needs improvement** — —
- **Suggestions**
  - Maintain consistent commit activity to avoid burnout and ensure steady progress.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9208.24
medianIntervalSeconds   █░░░░░░░░░░░  699
intervalCount           ░░░░░░░░░░░░  136
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9208.24 |
| medianIntervalSeconds | 699 |
| intervalCount | 136 |

- **What it means** — The commit cadence indicates frequent commits with a median interval of 699 seconds, suggesting a rapid development pace. This can be beneficial for iterative development but may also indicate fragmented work.
- **Strengths**
  - Frequent commits suggest active development and regular updates.
- **Needs improvement**
  - Consider whether the rapid pace is sustainable and if it allows for thorough code review.
- **Suggestions**
  - Encourage developers to batch related changes into fewer, more substantial commits to improve clarity and reviewability.

#### Active vs. dormant periods  ● ok

```
activePeriods   ████████████  1
dormantPeriods  ░░░░░░░░░░░░  0
```

- **Value** — 14
- **What it means** — There are no dormant periods within the analyzed timeframe, indicating continuous activity. This is a positive sign of ongoing development and engagement.
- **Strengths**
  - Continuous activity with no dormant periods shows consistent team involvement.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that the team maintains this level of activity without risking burnout.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████████  14.49
ageDays       ████████████  14.5
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 14.49 |
| ageDays | 14.5 |

- **What it means** — The project is very young, with a lifespan of just over 14 days. This suggests that the repository is in its initial stages of development.
- **Strengths**
  - Rapid development in the early stages of the project.
- **Needs improvement** — —
- **Suggestions**
  - Establish long-term goals and milestones to guide future development.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  147
p90          ███░░░░░░░░░  1209.4
max          ████████████  4428
mean         █░░░░░░░░░░░  494.45
commitCount  ░░░░░░░░░░░░  137
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 147 |
| p90 | 1209.4 |
| max | 4428 |
| mean | 494.45 |
| commitCount | 137 |

- **What it means** — The commit size distribution shows a wide range, with a median of 147 lines and a maximum of 4428 lines. This variability suggests differing scopes of work being committed.
- **Strengths**
  - The median commit size is manageable, indicating regular, incremental updates.
- **Needs improvement**
  - Large commits can be difficult to review and may hide issues.
- **Suggestions**
  - Encourage breaking down large changes into smaller, more manageable commits to improve reviewability.

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
24  ██░░░░░░░░░░  7
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
    - 24: 7
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 25

- **What it means** — The time-of-day and day-of-week patterns show peak activity in the late afternoon and early evening, particularly on weekdays. This suggests a typical work schedule with some evening work.
- **Strengths**
  - Consistent activity during standard working hours.
- **Needs improvement**
  - Evening work may indicate overtime, which could lead to burnout.
- **Suggestions**
  - Monitor workload to ensure that evening work is not excessive and that work-life balance is maintained.

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
  - The contributor base is small, which may limit diversity of ideas and resilience.
- **Suggestions**
  - Consider recruiting more contributors to increase diversity and resilience.

#### Contribution distribution  ▲ risk  **94.89/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.89 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.89% of commits and 99.37% of lines. This indicates a potential risk of over-reliance on a single contributor.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one person can lead to bottlenecks and risks if that person becomes unavailable.
- **Suggestions**
  - Encourage more balanced contribution by mentoring and involving the second contributor in more areas.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.89 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on a single contributor. If this person leaves, it could significantly impact the project.
- **Strengths** — —
- **Needs improvement**
  - The bus factor of 1 is a critical risk, indicating knowledge is not well distributed.
- **Suggestions**
  - Increase knowledge sharing and documentation to reduce reliance on a single contributor.

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

- **What it means** — All contributors are new within the last 90 days, with no departures. This suggests recent growth but also a lack of long-term stability.
- **Strengths**
  - No contributors have departed, indicating potential satisfaction or engagement.
- **Needs improvement**
  - All contributors being new may indicate a lack of experienced contributors.
- **Suggestions**
  - Focus on retaining contributors and building a stable, experienced team.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              █████████░░░  110
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
      - touchCount: 110
      - authorCount: 2
      - topAuthorSharePct: 89.09
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
      - touchCount: 10
      - authorCount: 1
      - topAuthorSharePct: 100
    - commit-whisper-report.md
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

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating a lack of shared ownership.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in many areas can lead to silos and reduce collaboration.
- **Suggestions**
  - Encourage pair programming and code reviews to increase shared ownership.

#### Co-authorship / collaboration signal  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| commitsWithCoAuthors | 0 |
| coAuthoredSharePct | 0 |
| totalCoAuthorTrailers | 0 |
| distinctCoAuthors | 0 |

- **What it means** — There are no co-authored commits, indicating a lack of collaboration in commit activities.
- **Strengths** — —
- **Needs improvement**
  - Lack of co-authorship suggests limited collaboration and peer review.
- **Suggestions**
  - Promote collaborative practices such as pair programming and joint code reviews.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **51.09/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 51.09 |
| commitCount | 137 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a median length of 64 characters and no empty messages. Over half of the commits include a body, suggesting detailed documentation.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
  - Over half of the commits include a detailed body.
- **Needs improvement** — —
- **Suggestions** — —

#### Conventional Commits adherence  ● ok  **81.75/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 112 |
| adherenceSharePct | 81.75 |
| subjectsConsidered | 137 |

- **What it means** — The adherence to Conventional Commits is high at 81.75%, indicating that most commit messages follow a structured format, which helps in maintaining clarity and consistency.
- **Strengths**
  - High adherence to Conventional Commits, enhancing clarity and consistency.
- **Needs improvement**
  - A small percentage of commits do not adhere to the convention.
- **Suggestions**
  - Encourage the team to review and follow the Conventional Commits guidelines to improve adherence further.

#### Imperative-mood / style signal  ● ok  **97.81/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 137 |
| imperativeMoodSharePct | 97.81 |
| capitalizedSubjectSharePct | 24.09 |
| noTrailingPeriodSharePct | 99.27 |

- **What it means** — The use of imperative mood in commit messages is very high at 97.81%, which is a best practice for clarity. However, only 24.09% of subjects are capitalized, which could be improved for consistency.
- **Strengths**
  - High use of imperative mood, which is a best practice.
- **Needs improvement**
  - Low percentage of capitalized subjects.
- **Suggestions**
  - Encourage capitalization of the first word in commit messages for consistency.

#### Low-information message rate  ● ok  **0/100**

- **Value**

| Field | Value |
| --- | --- |
| lowInfoCount | 0 |
| lowInfoSharePct | 0 |
| emptyCount | 0 |
| singleWordCount | 0 |
| boilerplateCount | 0 |
| commitCount | 137 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information.
- **Strengths**
  - All commit messages are informative with no low-information content.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.11/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.11 |
| commitCount | 137 |

- **What it means** — The issue reference rate is low at 5.11%, suggesting that commits are not frequently linked to specific issues or tickets, which could hinder traceability.
- **Strengths** — —
- **Needs improvement**
  - Low rate of issue or ticket references in commit messages.
- **Suggestions**
  - Encourage linking commits to relevant issues or tickets to improve traceability.

#### Revert / fixup / amend signal  ● ok  **0.73/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.73 |
| commitCount | 137 |

- **What it means** — The revert/fixup/amend signal is low, with only one revert and no fixups or squashes, indicating minimal churn and a stable commit history.
- **Strengths**
  - Low churn of intent, indicating a stable commit history.
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

#### Branch/merge topology summary  ● ok  **5.11/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 137 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.11 |
| regularCommitCount | 129 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with 5.11% of commits being merge commits. The low number of merge commits suggests a straightforward development process with minimal branching complexity.
- **Strengths**
  - The workflow is simple and easy to follow, reducing potential merge conflicts.
- **Needs improvement**
  - Consider increasing the use of feature branches to enhance code review and testing processes.
- **Suggestions**
  - Encourage the use of feature branches for new features or bug fixes to improve code quality and collaboration.

#### Merge vs. rebase tendency  ● ok  **5.11/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.11 |
| firstParentLinearityPct | 94.89 |

- **What it means** — The repository exhibits a mixed tendency between merging and rebasing, with a high first-parent linearity of 94.89%. This indicates a preference for keeping the commit history clean, although some merges are still present.
- **Strengths**
  - High linearity suggests a clean and understandable commit history.
- **Needs improvement**
  - The mixed tendency might lead to inconsistencies in the workflow.
- **Suggestions**
  - Establish clear guidelines on when to use merge vs. rebase to maintain consistency in the workflow.

#### Direct-to-default-branch rate  ▲ risk  **89.78/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 123 |
| directToDefaultSharePct | 89.78 |
| viaMergeCount | 14 |
| mainlineCommitCount | 130 |
| totalCommits | 137 |

- **What it means** — A high percentage (89.78%) of commits are made directly to the default branch, indicating a lack of feature branching. This can speed up development but may reduce opportunities for code review and testing.
- **Strengths**
  - Fast integration of changes into the mainline.
- **Needs improvement**
  - Lack of feature branches may lead to less thorough code reviews and testing.
- **Suggestions**
  - Encourage the use of feature branches to improve code quality and facilitate better testing and review processes.

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

- **What it means** — There are no long-lived branches in the repository, with the longest branch lasting only 0.01 days. This suggests that branches are merged quickly, reducing the risk of integration issues.
- **Strengths**
  - Quick merging of branches reduces the risk of integration conflicts.
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

- **What it means** — The average number of changes per merge is 60.71, with a median of 29. This indicates that merges are generally manageable in size, although there is a wide range in the number of changes per merge.
- **Strengths**
  - Merges are generally of a manageable size, facilitating easier reviews.
- **Needs improvement**
  - Some merges have a high number of changes, which can complicate reviews.
- **Suggestions**
  - Encourage more frequent, smaller merges to maintain manageable review sizes and reduce complexity.

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

- **What it means** — The 'Most-changed files / directories' metric shows which files and directories have been modified most frequently and extensively. High touch counts and churn in files like `package-lock.json` and `src/cli/interactive.ts` suggest these areas are under frequent development or refactoring.
- **Strengths**
  - Active development in key areas like `src/cli` indicates ongoing improvements.
- **Needs improvement**
  - High churn in `package-lock.json` may indicate dependency instability.
- **Suggestions**
  - Review dependency management practices to stabilize `package-lock.json`.
  - Consider refactoring `src/cli/interactive.ts` to reduce churn.

#### Churn rate over time  ● ok  `▅`

- **Value**
  - perMonth
    - 2026-06: 67739
  - totalChurn: 67739

- **What it means** — The 'Churn rate over time' metric indicates the volume of code changes, with a total churn of 67,739 lines in June 2026. This suggests a period of intense development or refactoring.
- **Strengths**
  - High activity level indicates active development.
- **Needs improvement**
  - Sustained high churn can lead to instability if not managed.
- **Suggestions**
  - Monitor the impact of changes on system stability.
  - Ensure adequate testing to accompany high churn periods.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  57189
totalDeletions  ██░░░░░░░░░░  10550
addDeleteRatio  ░░░░░░░░░░░░  5.42
netLines        ██████████░░  46639
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 57189 |
| totalDeletions | 10550 |
| addDeleteRatio | 5.42 |
| netLines | 46639 |

- **What it means** — The 'Add/delete ratio' of 5.42 indicates that for every line deleted, over five lines were added. This suggests a phase of expansion or feature addition.
- **Strengths**
  - Positive net lines indicate growth and feature development.
- **Needs improvement**
  - High addition rates without corresponding deletions can lead to code bloat.
- **Suggestions**
  - Review new additions for potential simplification or refactoring.
  - Ensure documentation is updated to reflect new features.

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

- **What it means** — The 'File survival / age' metric shows a median file age of 1.2 days, indicating frequent updates. A high number of single-touch files suggests many files are created and not revisited.
- **Strengths**
  - Frequent updates can indicate responsiveness to change.
- **Needs improvement**
  - Short file lifespan may indicate instability or lack of planning.
- **Suggestions**
  - Evaluate the necessity of frequently changed files to ensure they are essential.
  - Implement more thorough planning to reduce unnecessary file changes.

#### Large-change events  ● ok  **13.14/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 18 |
| largeChangeSharePct | 13.14 |

- **What it means** — The 'Large-change events' metric identifies 18 events where changes exceeded 1,000 lines, comprising 13.14% of all changes. This indicates significant updates or refactoring efforts.
- **Strengths**
  - Large changes can be beneficial for major updates or refactoring.
- **Needs improvement**
  - Frequent large changes can disrupt stability and increase risk.
- **Suggestions**
  - Break down large changes into smaller, manageable parts where possible.
  - Ensure comprehensive testing accompanies large changes to maintain stability.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  90.88
Commit Size Discipline  ██████████░░  78.44
```

#### Overall hygiene score  ◐ watch  **55.9/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 55.9 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 55.9 indicates a moderate level of codebase health. The score is a weighted average of several components, with Message Quality and Commit Size Discipline contributing positively. However, low scores in Branching Discipline and Collaboration Breadth significantly lower the overall score.
- **Strengths**
  - High Message Quality with a subScore of 90.88.
  - Good Commit Size Discipline with a subScore of 78.44.
- **Needs improvement**
  - Branching Discipline with a subScore of 10.22.
  - Collaboration Breadth with a subScore of 5.11.
- **Suggestions**
  - Improve Branching Discipline by establishing clear branching strategies and guidelines.
  - Enhance Collaboration Breadth by encouraging more team members to contribute to the codebase.

#### Bus-factor risk flag  ▲ risk  **94.89/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.89 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, indicating that a single person holds most of the knowledge about the codebase. This poses a significant risk if that person becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - High concentration of knowledge with one contributor holding 94.89% of the contribution share.
- **Suggestions**
  - Distribute knowledge by involving more team members in critical areas of the codebase.
  - Conduct regular knowledge-sharing sessions to reduce dependency on a single contributor.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  90.88
Commit Size Discipline  ██████████░░  78.44
```

- **Value**
  - strengths
    - Message Quality: 90.88
    - Commit Size Discipline: 78.44
  - weaknesses
    - Collaboration Breadth: 5.11
    - Branching Discipline: 10.22

- **What it means** — The strengths and weaknesses highlight areas of excellence and those needing improvement. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses.
- **Strengths**
  - Strong Message Quality with a subScore of 90.88.
  - Good Commit Size Discipline with a subScore of 78.44.
- **Needs improvement**
  - Collaboration Breadth with a subScore of 5.11.
  - Branching Discipline with a subScore of 10.22.
- **Suggestions**
  - Focus on improving Collaboration Breadth by encouraging more diverse contributions.
  - Enhance Branching Discipline by implementing better branching practices.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:48:57.898Z
