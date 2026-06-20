# commit-whisper — commit-whisper

_commit-whisper · 133 commits · 2 contributors · analyzed 2026-06-20_

**Confidence:** high — Grounding 100%, explanation coverage 100%, 3% of metrics not available.

## Summary

> The repository shows high activity but faces significant risks due to knowledge concentration and weak collaboration practices.

This repository has experienced a burst of activity over a short period, with a high volume of commits and a strong adherence to commit message standards. However, the project is heavily reliant on a single contributor, posing a high bus-factor risk. Additionally, the collaboration breadth and branching discipline are notably weak, indicating potential challenges in team scalability and code integration practices.

- Commit volume is high with 133 commits in June, indicating active development.
- The bus-factor is 1, with 94.74% of contributions from one author, posing a high risk.
- Collaboration breadth is low, with no co-authored commits.
- Branching discipline is weak, with 89.47% of commits going directly to the default branch.
- Commit message quality is strong, with 82.71% adherence to conventional standards.

## Explanation

The repository has seen a significant amount of activity in a short span, with 133 commits in June alone. This indicates a period of intense development. The commit frequency shows a median interval of 801 seconds between commits, suggesting rapid iterations.

Despite the high activity, the project is at risk due to a bus-factor of 1, meaning that one contributor is responsible for the majority of the work (94.74% of commits). This concentration of knowledge can be detrimental if the contributor becomes unavailable.

Collaboration is minimal, as evidenced by the absence of co-authored commits. This lack of collaborative effort could hinder knowledge sharing and team cohesion.

Branching practices are weak, with 89.47% of commits made directly to the default branch. This suggests a lack of structured workflow, which can complicate code integration and increase the risk of conflicts.

On a positive note, the commit messages are well-structured, with 82.71% adhering to conventional commit standards, which aids in maintaining clarity and traceability of changes.

## Coaching

The repository is currently in a phase of rapid development but faces challenges related to knowledge concentration and collaboration. This improvement plan focuses on addressing these issues to enhance team resilience and workflow efficiency.

### 1. Knowledge Distribution

- Encourage knowledge sharing by involving more contributors in key areas, reducing the bus-factor risk from 1.
- Implement pair programming or code reviews to distribute knowledge more evenly across the team.

### 2. Collaboration Enhancement

- Promote co-authorship by encouraging team members to work together on commits, aiming to increase the co-authored commit percentage from 0%.
- Introduce regular team meetings to discuss ongoing work and share insights, fostering a collaborative environment.

### 3. Branching Discipline

- Adopt a branching strategy such as Git Flow to reduce the 89.47% direct-to-default-branch rate.
- Train the team on effective branching practices to improve the branching discipline score from 10.53.

_The top priorities are to reduce the bus-factor risk by distributing knowledge and to improve collaboration breadth. Implementing a structured branching strategy will also enhance workflow efficiency. Addressing these areas will strengthen the repository's resilience and scalability._

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
2026-06-20  ░░░░░░░░░░░░  1
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
| 2026-06-20 | 1 |

- **What it means** — The commit volume shows a significant increase in activity over the analyzed period, with a peak in the third week of June. This suggests a period of intense development or a push to meet a deadline.
- **Strengths**
  - High activity in the third week indicates strong development efforts.
- **Needs improvement** — —
- **Suggestions**
  - Maintain consistent commit activity to avoid burnout and ensure steady progress.

#### Commit frequency / cadence  ● ok

```
averageIntervalSeconds  ████████████  9474.01
medianIntervalSeconds   █░░░░░░░░░░░  801
intervalCount           ░░░░░░░░░░░░  132
```

- **Value**

| Item | Value |
| --- | --- |
| averageIntervalSeconds | 9474.01 |
| medianIntervalSeconds | 801 |
| intervalCount | 132 |

- **What it means** — The average commit interval is approximately 2.6 hours, with a median of 13 minutes. This indicates frequent commits, suggesting active development and regular updates.
- **Strengths**
  - Frequent commits indicate active development and regular updates.
- **Needs improvement** — —
- **Suggestions**
  - Ensure that frequent commits are meaningful and not just minor changes to maintain code quality.

#### Active vs. dormant periods  ● ok  **14**

- **Value** — 14
- **What it means** — There are no dormant periods within the analyzed timeframe, indicating continuous activity. This is a positive sign of ongoing development and engagement.
- **Strengths**
  - Continuous activity with no dormant periods shows consistent engagement.
- **Needs improvement** — —
- **Suggestions**
  - Continue monitoring to ensure no future dormant periods occur.

#### Project age & lifespan  ● ok

```
lifespanDays  ████████████  14.47
ageDays       ████████████  14.48
```

- **Value**

| Item | Value |
| --- | --- |
| lifespanDays | 14.47 |
| ageDays | 14.48 |

- **What it means** — The project is very young, with a lifespan of just over 14 days. This suggests it is in the early stages of development.
- **Strengths**
  - Active development in the early stages of the project.
- **Needs improvement** — —
- **Suggestions**
  - Focus on establishing a strong foundation and clear project goals as the project matures.

#### Commit size distribution  ● ok

```
min          ░░░░░░░░░░░░  0
median       ░░░░░░░░░░░░  124
p90          ███░░░░░░░░░  1176.2
max          ████████████  4428
mean         █░░░░░░░░░░░  477.87
commitCount  ░░░░░░░░░░░░  133
```

- **Value**

| Item | Value |
| --- | --- |
| min | 0 |
| median | 124 |
| p90 | 1176.2 |
| max | 4428 |
| mean | 477.87 |
| commitCount | 133 |

- **What it means** — The commit size distribution shows a wide range, with a median of 124 lines and a maximum of 4428 lines. This suggests variability in the scope of changes being committed.
- **Strengths**
  - Diverse commit sizes can indicate flexibility in handling both small fixes and large features.
- **Needs improvement**
  - Large commits can be harder to review and integrate.
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
24  █░░░░░░░░░░░  3
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
    - 24: 3
  - byWeekday
    - 1: 18
    - 2: 32
    - 3: 2
    - 4: 24
    - 5: 34
    - 6: 2
    - 7: 21

- **What it means** — Most commits occur between 19:00 and 21:00 UTC, with a peak on Thursdays. This pattern may reflect team preferences or deadlines.
- **Strengths**
  - Consistent peak activity times suggest a regular working pattern.
- **Needs improvement** — —
- **Suggestions**
  - Consider aligning team meetings or reviews with peak activity times for efficiency.

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
  - All contributors are active.
- **Needs improvement**
  - The contributor base is small, which may limit diversity of ideas and resilience.
- **Suggestions**
  - Consider strategies to attract more contributors, such as outreach or open issues for newcomers.

#### Contribution distribution  ▲ risk  **94.74/100**

- **Value**

| Field | Value |
| --- | --- |
| authorCount | 2 |
| giniCommits | 0.45 |
| giniLines | 0.49 |
| topCommitSharePct | 94.74 |
| top3CommitSharePct | 100 |

- **What it means** — The contribution distribution shows a high concentration of work by one contributor, with 94.74% of commits and 99.33% of lines. This indicates a potential risk of over-reliance on a single contributor.
- **Strengths** — —
- **Needs improvement**
  - High concentration of contributions by one individual.
- **Suggestions**
  - Encourage more balanced contributions by mentoring or pairing less active contributors with the main contributor.

#### Bus-factor / knowledge concentration  ▲ risk  **50/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| thresholdPct | 50 |
| topAuthorSharePct | 94.74 |
| totalAuthors | 2 |

- **What it means** — The bus factor is 1, meaning the project heavily relies on one contributor. If this person were unavailable, it could significantly impact the project.
- **Strengths** — —
- **Needs improvement**
  - High risk due to reliance on a single contributor.
- **Suggestions**
  - Increase knowledge sharing and documentation to reduce dependency on one person.

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

- **What it means** — All contributors are new within the last 90 days, with no departures. This suggests recent growth but also a lack of long-term contributors.
- **Strengths**
  - No contributors have departed recently.
- **Needs improvement**
  - Lack of long-term contributors.
- **Suggestions**
  - Focus on retention strategies to maintain contributors over a longer period.

#### Ownership by area  ● ok

```
src/cli                        ████████████  150
docs/implementation-artifacts  ███████████░  137
.                              ████████░░░░  102
src/narrate                    █████░░░░░░░  61
src/config                     ████░░░░░░░░  53
src/retrieve                   ████░░░░░░░░  45
src/analyze                    ███░░░░░░░░░  37
src/license                    ███░░░░░░░░░  35
src/render/html                ███░░░░░░░░░  35
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
      - touchCount: 102
      - authorCount: 2
      - topAuthorSharePct: 88.24
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
    - src/analyze
      - touchCount: 37
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/license
      - touchCount: 35
      - authorCount: 1
      - topAuthorSharePct: 100
    - src/render/html
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
    - src/render/terminal/terminal-renderer.ts
      - touchCount: 7
      - authorCount: 1
      - topAuthorSharePct: 100

- **What it means** — Ownership by area shows that most directories and files are dominated by a single author, indicating a lack of shared ownership.
- **Strengths** — —
- **Needs improvement**
  - Single-author dominance in most areas.
- **Suggestions**
  - Promote code reviews and collaborative work to increase shared ownership.

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
  - No evidence of co-authorship or collaboration in commits.
- **Suggestions**
  - Encourage pair programming or collaborative commits to foster teamwork.

### C · Commit Message Quality

How clearly the history communicates intent.

_No group-overview chart — see the metrics below._

#### Message length distribution  ● ok  **49.62/100**

- **Value**

| Field | Value |
| --- | --- |
| emptyMessageCount | 0 |
| withBodySharePct | 49.62 |
| commitCount | 133 |

- **What it means** — The message length distribution indicates that commit messages are generally well-structured, with a median length of 64 characters and no empty messages. This suggests that commit messages are informative and likely provide sufficient context.
- **Strengths**
  - Commit messages are consistently informative with no empty messages.
- **Needs improvement** — —
- **Suggestions** — —

#### Conventional Commits adherence  ● ok  **82.71/100**

- **Value**

| Field | Value |
| --- | --- |
| adherentCount | 110 |
| adherenceSharePct | 82.71 |
| subjectsConsidered | 133 |

- **What it means** — The adherence to Conventional Commits is high at 82.71%, indicating that most commit messages follow a structured format, which helps in maintaining clarity and consistency across the repository.
- **Strengths**
  - High adherence to Conventional Commits, enhancing clarity and consistency.
- **Needs improvement**
  - A small percentage of commits do not adhere to the convention.
- **Suggestions**
  - Encourage the team to review and follow the Conventional Commits guidelines to improve adherence further.

#### Imperative-mood / style signal  ● ok  **97.74/100**

- **Value**

| Field | Value |
| --- | --- |
| subjectsConsidered | 133 |
| imperativeMoodSharePct | 97.74 |
| capitalizedSubjectSharePct | 23.31 |
| noTrailingPeriodSharePct | 99.25 |

- **What it means** — The imperative mood is used in 97.74% of commit messages, which is a best practice for writing clear and actionable commit messages. This indicates strong adherence to recommended commit message styles.
- **Strengths**
  - High use of imperative mood, which is a best practice.
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
| commitCount | 133 |

- **What it means** — There are no low-information messages, indicating that all commit messages provide meaningful information. This is a positive sign of effective communication within the repository.
- **Strengths**
  - All commit messages are informative with no low-information content.
- **Needs improvement** — —
- **Suggestions** — —

#### Issue/ticket reference rate  ● ok  **5.26/100**

- **Value**

| Field | Value |
| --- | --- |
| withReferenceCount | 7 |
| referenceSharePct | 5.26 |
| commitCount | 133 |

- **What it means** — Only 5.26% of commits reference issues or tickets, suggesting that there may be room to improve traceability between commits and project management tools.
- **Strengths** — —
- **Needs improvement**
  - Low rate of issue or ticket references in commit messages.
- **Suggestions**
  - Encourage developers to reference relevant issues or tickets in commit messages to improve traceability.

#### Revert / fixup / amend signal  ● ok  **0.75/100**

- **Value**

| Field | Value |
| --- | --- |
| revertCount | 1 |
| fixupCount | 0 |
| squashCount | 0 |
| churnOfIntentCount | 1 |
| churnOfIntentSharePct | 0.75 |
| commitCount | 133 |

- **What it means** — The low churn of intent (0.75%) indicates that there are very few reverts or fixups, suggesting that commits are generally well-considered and stable.
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

#### Branch/merge topology summary  ● ok  **5.26/100**

- **Value**

| Field | Value |
| --- | --- |
| totalCommits | 133 |
| mergeCommitCount | 7 |
| mergeSharePct | 5.26 |
| regularCommitCount | 125 |
| rootCommitCount | 1 |
| octopusMergeCount | 0 |

- **What it means** — This metric shows that the repository primarily uses a merge-based workflow, with 133 total commits and 7 merge commits, making up 5.26% of the total. The low number of merge commits suggests a straightforward development process with minimal branching complexity.
- **Strengths**
  - Low merge commit count indicates a streamlined workflow.
- **Needs improvement** — —
- **Suggestions** — —

#### Merge vs. rebase tendency  ● ok  **5.26/100**

- **Value**

| Field | Value |
| --- | --- |
| mergeSharePct | 5.26 |
| firstParentLinearityPct | 94.74 |

- **What it means** — The repository has a mixed tendency between merging and rebasing, with a 5.26% merge share and 94.74% first-parent linearity. This suggests that while merges are used, there is a strong preference for maintaining a linear history, possibly through rebasing.
- **Strengths**
  - High first-parent linearity indicates a preference for a clean history.
- **Needs improvement** — —
- **Suggestions** — —

#### Direct-to-default-branch rate  ▲ risk  **89.47/100**

- **Value**

| Field | Value |
| --- | --- |
| directToDefaultCount | 119 |
| directToDefaultSharePct | 89.47 |
| viaMergeCount | 14 |
| mainlineCommitCount | 126 |
| totalCommits | 133 |

- **What it means** — A high percentage (89.47%) of commits are made directly to the default branch. This indicates a tendency to bypass feature branches, which can lead to less isolated development and potential integration issues.
- **Strengths** — —
- **Needs improvement**
  - High direct-to-default rate suggests a lack of feature branch usage.
- **Suggestions**
  - Encourage the use of feature branches to isolate changes and improve code review processes.

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

- **What it means** — There are no long-lived branches, with the longest branch lasting only 0.01 days. This suggests that branches are either merged quickly or not used extensively, which can be beneficial for rapid development cycles.
- **Strengths**
  - No long-lived branches indicate efficient merging practices.
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

- **What it means** — The average number of changes per merge is 60.71, with a median of 29 and a maximum of 234. This indicates variability in the size of changes being integrated, which can affect the ease of code review and integration.
- **Strengths**
  - No merges with no unique commits suggest meaningful integration.
- **Needs improvement**
  - High variability in changes per merge can complicate reviews.
- **Suggestions**
  - Aim for more consistent merge sizes to streamline code reviews and integration.

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
    - 2026-06: 63557
  - totalChurn: 63557

- **What it means** — The 'Churn rate over time' metric indicates the amount of code added and removed over a period. A total churn of 63,557 lines in June 2026 suggests significant development activity, possibly due to new features or refactoring.
- **Strengths**
  - High development activity indicates progress and potential feature additions.
- **Needs improvement**
  - High churn can indicate instability or frequent changes that may affect code quality.
- **Suggestions**
  - Ensure adequate testing and code reviews to maintain quality amidst high churn.
  - Analyze if the churn is due to necessary changes or if it can be reduced by improving initial code quality.

#### Add/delete ratio  ● ok

```
totalAdditions  ████████████  54965
totalDeletions  ██░░░░░░░░░░  8592
addDeleteRatio  ░░░░░░░░░░░░  6.4
netLines        ██████████░░  46373
```

- **Value**

| Item | Value |
| --- | --- |
| totalAdditions | 54965 |
| totalDeletions | 8592 |
| addDeleteRatio | 6.4 |
| netLines | 46373 |

- **What it means** — The 'Add/delete ratio' of 6.4 indicates that for every line deleted, 6.4 lines were added. This suggests a focus on expanding the codebase, possibly with new features or enhancements.
- **Strengths**
  - A high add/delete ratio can indicate growth and feature development.
- **Needs improvement**
  - A high ratio might also suggest insufficient refactoring or cleanup.
- **Suggestions**
  - Balance new additions with refactoring to maintain code quality.
  - Regularly review and remove obsolete code to improve maintainability.

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
  - Short file age may suggest instability or frequent rework.
- **Suggestions**
  - Investigate if frequent changes are due to evolving requirements or if they indicate design issues.
  - Implement more stable design patterns to reduce unnecessary file changes.

#### Large-change events  ● ok  **12.03/100**

- **Value**

| Field | Value |
| --- | --- |
| thresholdLines | 1000 |
| largeChangeCount | 16 |
| largeChangeSharePct | 12.03 |

- **What it means** — The 'Large-change events' metric identifies 16 events where changes exceeded 1,000 lines, making up 12.03% of all changes. This indicates significant updates or refactoring efforts.
- **Strengths**
  - Large changes can reflect major improvements or feature additions.
- **Needs improvement**
  - Frequent large changes can disrupt stability and increase the risk of introducing bugs.
- **Suggestions**
  - Break down large changes into smaller, manageable commits to reduce risk.
  - Ensure comprehensive testing and review processes for large changes to maintain stability.

### F · Repository Health Signals

Overall repository health signals.

```
Message Quality         ████████████  91.35
Commit Size Discipline  ███████████░  83.56
```

#### Overall hygiene score  ◐ watch  **57.31/100**

- **Value**

| Field | Value |
| --- | --- |
| score | 57.31 |
| componentsContributing | 4 |

- **What it means** — The overall hygiene score of 57.31 indicates a moderate level of codebase health. The score is a weighted average of several components, with strong performance in Message Quality and Commit Size Discipline, but significant weaknesses in Branching Discipline and Collaboration Breadth. Churn Stability was not included due to lack of data.
- **Strengths**
  - High Message Quality
  - Good Commit Size Discipline
- **Needs improvement**
  - Branching Discipline
  - Collaboration Breadth
- **Suggestions**
  - Improve branching practices by adopting a more structured workflow.
  - Encourage broader collaboration across the team to enhance Collaboration Breadth.

#### Bus-factor risk flag  ▲ risk  **94.74/100**

- **Value**

| Field | Value |
| --- | --- |
| busFactor | 1 |
| topAuthorSharePct | 94.74 |

- **What it means** — The bus-factor risk is high, with a bus factor of 1, meaning that a single person holds a significant amount of knowledge (94.74% of contributions). This poses a risk to the project's sustainability if that person becomes unavailable.
- **Strengths** — —
- **Needs improvement**
  - Reduce knowledge concentration by distributing responsibilities more evenly across the team.
- **Suggestions**
  - Implement pair programming or code reviews to share knowledge.
  - Encourage documentation of key processes and code areas.

#### Trend deltas  ○ n/a

- **Value** — _not available — No prior report available for trend comparison._
- **What it means** — Trend deltas could not be computed because there is no prior report available for comparison. This means we cannot assess changes over time in this analysis.
- **Strengths** — —
- **Needs improvement** — —
- **Suggestions** — —

#### Hygiene strengths & weaknesses  ● ok

```
Message Quality         ████████████  91.35
Commit Size Discipline  ███████████░  83.56
```

- **Value**
  - strengths
    - Message Quality: 91.35
    - Commit Size Discipline: 83.56
  - weaknesses
    - Collaboration Breadth: 5.26
    - Branching Discipline: 10.53

- **What it means** — The strengths and weaknesses highlight areas of high and low performance. Message Quality and Commit Size Discipline are strengths, while Collaboration Breadth and Branching Discipline are weaknesses, aligning with the overall hygiene score components.
- **Strengths**
  - Strong Message Quality
  - Effective Commit Size Discipline
- **Needs improvement**
  - Collaboration Breadth
  - Branching Discipline
- **Suggestions**
  - Foster a more inclusive collaboration environment.
  - Adopt a more consistent branching strategy.

---
Generated by commit-whisper v1.1.2 · schemaVersion 1.0.0 · openai/gpt-4o · 2026-06-20T23:27:34.437Z
