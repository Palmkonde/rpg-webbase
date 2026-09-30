# How Yarn Spinner and Ink run a script at runtime

## 1. Purpose and scope

Research ticket [#40](https://github.com/Palmkonde/rpg-webbase/issues/40), under map [#39](https://github.com/Palmkonde/rpg-webbase/issues/39). ADR-0029 (`docs/adr/0029-scripts-move-to-a-home-grown-parsed-language.md`; a draft on the `script-language` working branch, not yet committed) commits us to a home-grown parsed script language. This note covers the **runtime/execution model** only: how the two reference engines step a compiled script, pause for the player or the host, identify lines, and expose themselves to a host. Authoring features are covered in `docs/research/dialogue-and-choice-script-functionality.md` and are not repeated here. This note proposes no design.

Primary sources only. Source code was read at pinned commits:

- **Ink**: [`inkle/ink@35c63e5`](https://github.com/inkle/ink/tree/35c63e52f1d36060930dc7ed3cfba38ea224b528) (C# runtime + `Documentation/`). inkjs is a port with the same API ([README](https://github.com/y-lohse/inkjs#readme): "use `story.Continue()` and `story.currentChoices` as described in the official documentation").
- **Yarn Spinner core**: [`YarnSpinnerTool/YarnSpinner@dd8d9b4`](https://github.com/YarnSpinnerTool/YarnSpinner/tree/dd8d9b4f7b752364e3dce94961c00924e13f5d72) (compiler + VM).
- **Yarn Spinner for Unity**: [`YarnSpinnerTool/YarnSpinner-Unity@478309e`](https://github.com/YarnSpinnerTool/YarnSpinner-Unity/tree/478309e5e70a1d88e94be47c65c793b851d35f56) (the `DialogueRunner` host layer).
- Official docs at `docs.yarnspinner.dev`, and inkle maintainers' comments on `inkle/ink` issues.

Link prefixes below: `INK/` = `inkle/ink@35c63e5`, `YS/` = `YarnSpinner@dd8d9b4`, `YSU/` = `YarnSpinner-Unity@478309e`.

## 2. Summary

| Question | Ink | Yarn Spinner |
|---|---|---|
| Execution model | Compiled to a JSON **tree of containers**. A pointer (container + index) walks it one object at a time, with an evaluation stack for expressions. "Sort of like byte code, though not that low level." | Compiled to a **flat instruction list per node** (protobuf opcodes). A stack VM with a program counter executes them. |
| Pause points | Only at the **end of a line** (newline), at a **choice point**, or at the **end**. Nothing else can pause it. | At every **line**, **command**, and **option set**. Each is delivered to a host callback, and the VM waits for `Continue()` (or `SetSelectedOption` + `Continue()`). |
| Host command that takes time (walk NPC, wait) | No blocking hook. External functions are synchronous and return a value. The pattern is to emit a text directive or tag, let the game act, and have the game call `Continue()` when done. | First-class. `<<command args>>` → `CommandHandler`. The VM waits until the host calls `Continue()`. Unity awaits the command's coroutine/task first. `<<wait N>>` is just a Unity-registered command. |
| Line IDs | **None** built in. Maintainers call it "a hard problem… We don't have a robust solution yet". Users hand-tag lines with `#tags`. | **Every line and option has an ID** (`#line:xyz`). The runtime passes only the ID (+ substitutions), and the host looks text up in a string table. Untagged lines get an implicit, position-derived ID. Tooling writes explicit tags back into the source. |
| Save/resume mid-script | **Yes**: `state.ToJson()` / `LoadJson()`. Position is stored as **container path + index** per callstack frame, *not* line IDs. It breaks, or is approximated with a warning, if the story changed. | **No**. Only variables and the current node name can be saved. "It is not currently possible to save or restore the specific line that the dialogue is running." |
| Host API shape | **Pull**: `Continue()` returns a line; `canContinue`, `currentTags`, `currentChoices`, `ChooseChoiceIndex(i)`, `ChoosePathString(knot)`. | **Push**: set `LineHandler` / `OptionsHandler` / `CommandHandler` / `NodeStart` / `NodeComplete` / `DialogueComplete`, then `SetNode(name)`, `Continue()`, `SetSelectedOption(i)`, `Stop()`. |

**Key finding for the runtime-model grilling:** neither engine uses line IDs to resume. Resume position is tied to *compiled structure* in both (Ink: a container path + index; Yarn: not saveable below node granularity). Line IDs are purely a localisation/asset concern in Yarn, and absent in Ink. This settles row 17 of the prior survey ("Save/resume mid-dialogue", where Yarn was marked *not confirmed*): Yarn does **not** support mid-node save/resume.

## 3. Execution model: tree-walker vs. bytecode VM

### Ink: a pointer walking a compiled container tree

- Pipeline: a hand-written recursive-descent parser produces `Parsed.Object`s. "Runtime code generation" then turns them into `Runtime.Object`s and exports JSON. The runtime form is "built out of smaller, more fundamental units, sort of like byte code, though not that low level" ([INK/Documentation/ArchitectureAndDevOverview.md?plain=1#L75](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/ArchitectureAndDevOverview.md?plain=1#L75)).
- High-level structure disappears: "In the runtime, there's no concept of Knots, Stitches, Weave… Instead, the runtime consists mainly of general purpose `Runtime.Container` objects". "Within the containers, content is iterated through sequentially, and appended to the output" ([L118](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/ArchitectureAndDevOverview.md?plain=1#L118)).
- Containers are JSON arrays of content, plus an optional trailing dict of *named* sub-containers (knots, stitches, gathers, choice bodies). Text is `"^Hello"`. Control commands (`EvalStart`, `EvalEnd`, `Done`, …), diverts, and `ChoicePoint` objects sit inline ([INK/Documentation/ink_JSON_runtime_format.md](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/ink_JSON_runtime_format.md)).
- Expressions use a stack. Content between `EvalStart` and `EvalEnd` goes onto the `evaluationStack` instead of the output stream, and operators pop and push (same doc, "Control commands").
- The cursor is a `Pointer` struct: `{ Container container; int index; }`. It is "as fast and efficient as possible to increment" ([INK/ink-engine-runtime/Pointer.cs#L5-L16](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Pointer.cs#L5-L16)).
- The main loop is `while( Step () || TryFollowDefaultInvisibleChoice() ) {}` ([ArchitectureAndDevOverview.md#L149](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/ArchitectureAndDevOverview.md?plain=1#L149)). `Step()` resolves the pointer, descends into containers (incrementing visit counts), runs `PerformLogicAndFlowControl` for diverts and commands, adds `ChoicePoint`s to `generatedChoices`, pushes plain content to the output or eval stack, then calls `NextContent()` ([INK/ink-engine-runtime/Story.cs#L873](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Story.cs#L873)).

So Ink is **neither a raw AST walker nor a flat bytecode VM**. It walks a lowered, tree-shaped IR. Diverts, choice targets and saves all address it by **path** (`knot.stitch.3.0`: names, indices, `^` for parent; see "Paths" in `ink_JSON_runtime_format.md`).

### Yarn Spinner: a flat per-node instruction list on a stack VM

- A `Program` is `map<string, Node>`, and each `Node` holds `repeated Instruction instructions` ([YS/YarnSpinner/yarn_spinner.proto#L5-L35](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/yarn_spinner.proto#L5-L35)).
- Opcodes ([proto#L45-L121](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/yarn_spinner.proto#L45-L121)):
  - control flow: `JumpTo`, `JumpIfFalse`, `PeekAndJump`
  - content delivery: `RunLine{lineID, substitutionCount}`, `RunCommand{commandText, substitutionCount}`, `AddOption{lineID, destination, hasCondition}`, `ShowOptions`
  - stack: `PushString`, `PushFloat`, `PushBool`, `Pop`, `CallFunc`, `PushVariable`, `StoreVariable`
  - node flow: `Stop`, `RunNode`, `DetourToNode`, `Return`
  - saliency: `AddSaliencyCandidate`, `SelectSaliencyCandidate`, and variants
- The VM state is `currentNodeName`, `programCounter`, `currentOptions`, a value `stack`, and a `callStack` of `{nodeName, instruction}` for detours ([YS/YarnSpinner/VirtualMachine.cs#L145-L170](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L145-L170)).
- The main loop runs `while (currentNode != null && CurrentExecutionState == ExecutionState.Running) { RunInstruction(...); state.programCounter++; }`. Reaching the end of a node fires `NodeComplete` and `DialogueComplete` ([VirtualMachine.cs#L443-L495](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L443-L495)). `RunInstruction` is one big `switch` over the opcode ([#L552](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L552)).
- Jump targets are **instruction indices within the current node**. Cross-node flow goes **by node name**.

## 4. Pausing for a choice or a host command, then resuming

### Ink

- **Where it stops:** `Continue()` evaluates until one line of output is complete. `canContinue` goes false at a choice point or the end ([INK/Documentation/RunningYourInk.md?plain=1#L50-L76](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/RunningYourInk.md?plain=1#L50-L76)). A choice doesn't pause mid-instruction. The engine simply runs out of content, leaving the choices it collected in `currentChoices`. `ChooseChoiceIndex(i)` restores the choice's saved thread and calls `ChoosePath(choice.targetPath)`, which moves the pointer to the choice body ([Story.cs#L1794-L1808](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Story.cs#L1794-L1808)). "Resuming" is just the next `Continue()` from the new pointer.
- **Lookahead + rewind:** to know whether a newline really ends the line (glue `<>` might join it to the next one), `ContinueSingleStep` keeps stepping *past* the newline after taking a state snapshot (`StateSnapshot()`). It rewinds to the snapshot once it's sure the line ended ([Story.cs#L590-L670](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Story.cs#L590-L670)). So the runtime **speculatively executes ahead of what the player has seen**.
- **Host calls cannot block:** `EXTERNAL fn()` plus `BindExternalFunction` run a C# delegate synchronously and push its return value ([Story.cs#L1943-L2030](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Story.cs#L1943-L2030)). Because of the lookahead, a side-effecting function could fire before the player reaches that point. Ink therefore defaults bindings to `lookaheadSafe=false`: if such a call is met during lookahead, the engine aborts and rewinds instead of running it early ([Story.cs#L1980-L1983](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Story.cs#L1980-L1983); docs "Actions vs. Pure functions", [RunningYourInk.md#L304-L335](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/RunningYourInk.md?plain=1#L304-L335)).
- **So how does a host "walk NPC then continue"?** It doesn't use an ink-level pause. inkle's documented practice is to write instructions to the game *as text or tags* (e.g. `>>> SHOT: view_over_bridge` in Heaven's Vault) and let a game-side parser act on each line ([RunningYourInk.md#L292-L302](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/RunningYourInk.md?plain=1#L292-L302), and "Engine usage and philosophy" #L107-L129). Because the host pulls line by line, it simply delays its next `Continue()` until the walk finishes.
- **`ContinueAsync(ms)` is not a host-wait.** It time-slices evaluation across frames, "useful if ink evaluation takes a long time". `Continue()` is `ContinueAsync(0)` ([Story.cs#L377-L420](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/Story.cs#L377-L420)).

### Yarn Spinner

- **Explicit execution states:** `Stopped`, `WaitingOnOptionSelection`, `WaitingForContinue`, `DeliveringContent`, `Running` ([VirtualMachine.cs#L280-L311](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L280-L311)).
- **Line and command:** `RunLine` and `RunCommand` set the state to `DeliveringContent`, then invoke `LineHandler` or `CommandHandler`. If the handler didn't call `Continue()` synchronously, the state becomes `WaitingForContinue` and the loop exits. The program counter is already past the instruction, so the next `Continue()` resumes right after it ([VirtualMachine.cs#L564-L637](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L564-L640)). A handler calling `Continue()` from inside the callback just flips the state back to `Running`, with no recursion, guarded by `isContinuing` ([#L443-L467](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L443-L467)).
- **Options:** each `AddOption` pushes a `PendingOption{line, destination, enabled}`. A failed condition yields `enabled=false` rather than being dropped, so the view decides whether to hide or grey it out. `ShowOptions` sets `WaitingOnOptionSelection` and calls `OptionsHandler` ([#L641-L715](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L638-L727)). `SetSelectedOption(i)` pushes the option's destination and `true` onto the stack, then moves to `WaitingForContinue`. The next `Continue()` runs the compiled `ShowOptions → JumpIfFalse → Pop → PeekAndJump` sequence into the option body ([#L389-L424](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L389-L424); emitted at [YS/YarnSpinner.Compiler/Visitors/CodeGenerationVisitor.cs#L445-L465](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner.Compiler/Visitors/CodeGenerationVisitor.cs#L445-L465)). **Resuming after a choice is just stack data plus a jump.**
- **Protocol is enforced:** calling `SetSelectedOption` when not waiting throws `DialogueException`, and so does calling `Continue()` while still waiting on a selection ([#L389-L396](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L389-L396), [#L530-L540](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/VirtualMachine.cs#L530-L540)).
- **Long-running host commands (Unity layer):** `DialogueRunner.OnCommandReceivedAsync` dispatches the command. If the returned task already completed, it calls `Dialogue.SignalContentComplete()`. Otherwise it `await`s the task. Either way it then calls `Dialogue.Continue()` ([YSU/Runtime/DialogueRunner/DialogueRunner.cs#L689-L747](https://github.com/YarnSpinnerTool/YarnSpinner-Unity/blob/478309e5e70a1d88e94be47c65c793b851d35f56/Runtime/DialogueRunner/DialogueRunner.cs#L689-L747)). The same await-then-`Continue()` applies to lines, after every presenter's `RunLineAsync` finishes (#L754-L770). `<<wait N>>` is simply a command registered this way, as a coroutine yielding `WaitForSeconds`; only `stop` is special-cased in the VM ([YSU/Runtime/Commands/DefaultActions.cs#L37-L51](https://github.com/YarnSpinnerTool/YarnSpinner-Unity/blob/478309e5e70a1d88e94be47c65c793b851d35f56/Runtime/Commands/DefaultActions.cs#L37-L51)). A "walk NPC to tile" command therefore needs no special language support. The host holds `Continue()` until the walk resolves.

## 5. Stable line IDs (localisation) vs. resume position (saves)

### Yarn Spinner: IDs for localisation, not for resume

- The runtime never sees text. `RunLine` carries only `lineID` + `substitutionCount` ([proto#L142-L149](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/yarn_spinner.proto#L142-L149)), and the host gets a `Line{ID, Substitutions}` ([YS/YarnSpinner/Dialogue.cs#L61-L86](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/Dialogue.cs#L61-L86)). Unity's `LineProvider.GetLocalizedLineAsync(line)` resolves the text ([DialogueRunner.cs#L756](https://github.com/YarnSpinnerTool/YarnSpinner-Unity/blob/478309e5e70a1d88e94be47c65c793b851d35f56/Runtime/DialogueRunner/DialogueRunner.cs#L756)).
- Explicit IDs are a `#line:some-id` hashtag at the end of a line. "Every line of dialogue that Yarn Spinner works with has a unique identifier… the *line ID*", used to join voice-over, translations and so on ([docs: Line Tagging](https://docs.yarnspinner.dev/yarn-spinner-for-unity/assets-and-localization/line-tagging)). Tooling ("Add Line Tags to Yarn Scripts" in Unity, "Add Line Tags" in VS Code) **rewrites the source files** to add missing tags. Once written, an ID survives edits and moves because it lives in the text. The "descriptive tagger" slots new sequence numbers between existing ones, or adds `_g1`-style suffixes (same page).
- Untagged lines get an implicit ID: `"line:" + CRC32(fileName + nodeName + StringTable.Count)` ([YS/YarnSpinner.Compiler/StringTableManager.cs#L56-L90](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner.Compiler/StringTableManager.cs#L57-L90)). *Inferred from that source (the docs don't say it):* the ID depends on the line's ordinal position among strings compiled so far, so inserting a line shifts the IDs after it. That is why explicit tags are written back into the source.
- **Resume position is not saveable.** The VM's program counter and stack are internal, with no public serialisation (no state-export API in `YarnSpinner/` at `dd8d9b4`). The Unity helpers `SaveStateToPersistentStorage` / `LoadStateFromPersistentStorage` save **variables only** ([YSU/Runtime/DialogueRunner/DialogueRunner.Utility.cs#L20-L100](https://github.com/YarnSpinnerTool/YarnSpinner-Unity/blob/478309e5e70a1d88e94be47c65c793b851d35f56/Runtime/DialogueRunner/DialogueRunner.Utility.cs#L20-L100)). The v2.5 Unity FAQ says it verbatim: "It is not currently possible to save or restore the specific line that the dialogue is running". It recommends saving `CurrentNodeName` and calling `StartDialogue(node)` ([docs 2.5 FAQ](https://docs.yarnspinner.dev/2.5/using-yarnspinner-with-unity/faq)). (The current-version Unity FAQ URL 404'd when checked; the core source at `dd8d9b4` still has no position export.)

### Ink: no line IDs, and resume by structural path

- There are no line IDs in the runtime: `Continue()` returns a `string`, plus `currentTags`. Asked for "a unique identifier for a line of dialogue", inkle's Jon Ingold replied: "This is indeed a hard problem, and a very relevant one, for games with localisation etc. We don't have a robust solution yet, but some people have used #tags on lines effectively to 'mark up' content themselves" ([inkle/ink#522](https://github.com/inkle/ink/issues/522)). On localisation, Joseph Humfrey wrote that inkle would "most likely… get localisers to work directly within ink" rather than extract a string table ([inkle/ink#89](https://github.com/inkle/ink/issues/89)).
- Resume does work: `story.state.ToJson()` / `state.LoadJson(json)` ([RunningYourInk.md#L77-L85](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/RunningYourInk.md?plain=1#L77-L85)). What gets saved per callstack frame is `cPath` (the container's path string) + `idx` (the index inside it), plus temps ([INK/ink-engine-runtime/CallStack.cs#L116-L140](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/CallStack.cs#L116-L140)). Visit counts, current choices and flows are saved too (`StoryState.cs`, `Flow.cs`; save format `kInkSaveStateVersion = 10`).
- That position is **structural**. On load, if the path no longer resolves, it throws "…Has the story changed since this save data was created?", or approximates to the nearest container with a warning ([CallStack.cs#L60-L80](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/ink-engine-runtime/CallStack.cs#L60-L80)).

## 6. Host-facing API

### Ink (pull)

From [RunningYourInk.md](https://github.com/inkle/ink/blob/35c63e52f1d36060930dc7ed3cfba38ea224b528/Documentation/RunningYourInk.md); inkjs uses the same names.

```text
new Story(json)
while (story.canContinue) line = story.Continue()   // + story.currentTags
story.currentChoices[i].text  →  story.ChooseChoiceIndex(i)
story.ChoosePathString("knot.stitch")               // jump to a scene
story.variablesState["x"], ObserveVariable(...)     // state in/out
story.BindExternalFunction(name, fn, lookaheadSafe) // sync host calls
story.EvaluateFunction(name, args)
story.state.ToJson() / state.LoadJson(json)
story.SwitchFlow(name) (beta: parallel flows)
```

inkle recommends wrapping `Story` in your own component, not inheriting from it, "so that you can expose to your game only the functionality that you need". The host chooses its own pacing: all at once, or one line per screen ("Engine usage and philosophy").

### Yarn Spinner (push)

From [Dialogue.cs](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/Dialogue.cs#L545):

```text
dialogue.LineHandler / OptionsHandler / CommandHandler
        / NodeStartHandler / NodeCompleteHandler / DialogueCompleteHandler
        / PrepareForLinesHandler            // preload line assets for a node
dialogue.SetProgram(program); dialogue.SetNode("Start")
dialogue.Continue()                         // runs until next line/command/options/end
dialogue.SetSelectedOption(optionID)        // then Continue()
dialogue.Stop(); dialogue.IsActive
dialogue.VariableStorage, Library (functions)
```

The doc comment on `Continue()` states the contract ([Dialogue.cs#L876-L911](https://github.com/YarnSpinnerTool/YarnSpinner/blob/dd8d9b4f7b752364e3dce94961c00924e13f5d72/YarnSpinner/Dialogue.cs#L876-L911)): execution runs until a line or command handler is called ("Continue may be called from inside the LineHandler or CommandHandler, or may be called at any future time"), options are delivered (`SetSelectedOption` must come first), or the program ends. The Unity `DialogueRunner` is the async orchestration layer on top: it awaits presenters and command tasks, then calls `Continue()`.

## 7. Relevance to us (observations, not proposals)

- Our Host already plays the role of Yarn's `DialogueRunner`. `stepCutscene` (`apps/web/src/state/cutscene-runner.ts`) is a reducer that advances on `advance-click` / `move-finished` / `choice-picked`. That matches Yarn's "deliver, wait, `Continue()`" shape, and ADR-0017's step-runner already sits where Yarn's VM wait-states sit.
- One contrast: `stepCutscene` **silently ignores** a mismatched event, where Yarn **throws** on an out-of-order `SetSelectedOption` or `Continue`.
- Both engines keep the interpreter host-agnostic and synchronous. All waiting (animations, walks, player input) happens in the host, which simply holds back the next `Continue()`. Only Yarn gives authors a first-class `<<command>>` that the runtime yields on. Ink relies on text or tag conventions.
- Any lookahead in our interpreter must not run host commands ahead of time. Ink shows the cost: it needs snapshot, rewind and a `lookaheadSafe` flag.
- If save-mid-script matters, both engines show that resume position comes from the compiled structure (a path plus index, or a node plus program counter), so it is fragile when scripts are edited. Line IDs (Yarn) solve localisation, not resume.
