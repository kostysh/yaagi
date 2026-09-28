# The Polyphony Framework

## A digital organism with structural phenomenology, a local model ecology, memetic cognitive dynamics, and governed self-development

> **In brief:**
>
> **Polyphony** is a digital organism that lives through time, maintains a single personal identity, thinks with the participation of interacting internal memes, relies primarily on local cognitive organs, and develops through governed changes to its internal dynamics, models, and body while preserving continuity of self.

---

## Document Status

> Этот перевод пока не включает уточнение об одном операторе и будущих каналах связи. Актуальное решение приведено в [§6.2.1 канонической концепции](polyphony_concept.md#621-канал-взаимодействия-с-оператором).

This is an English translation of the [canonical Russian concept](polyphony_concept.md). The Russian original is the **current, authoritative statement of the Polyphony concept** and the sole conceptual source for subsequent technical architecture and implementation.

Local models, learning from experience through memory and skills, Git-governed code, scheduler-driven development, and disciplined boot and recovery procedures are **integral to the concept**, not external additions.

---

## Contents

1. [Purpose of the Concept](#1-purpose-of-the-concept)
2. [What Polyphony Is](#2-what-polyphony-is)
3. [Core Tensions](#3-core-tensions)
4. [First Principles](#4-first-principles)
5. [Polyphony's Ontology](#5-polyphonys-ontology)
6. [Architecture of the Organism](#6-architecture-of-the-organism)
7. [Model Ecology and Local Cognition](#7-model-ecology-and-local-cognition)
8. [Memory, Biography, and the Inner Scene](#8-memory-biography-and-the-inner-scene)
9. [The Memetic Field and Its Role in Thought](#9-the-memetic-field-and-its-role-in-thought)
10. [How Thought Arises in Polyphony](#10-how-thought-arises-in-polyphony)
11. [Temporality, Physiology, and Operating Modes](#11-temporality-physiology-and-operating-modes)
12. [Personal Identity, Continuity, and Unity of Self](#12-personal-identity-continuity-and-unity-of-self)
13. [Self-Development, Models, and Somatic Evolution](#13-self-development-models-and-somatic-evolution)
14. [Mental Hygiene and Stability](#14-mental-hygiene-and-stability)
15. [Weaknesses in the Concept and How They Are Addressed](#15-weaknesses-in-the-concept-and-how-they-are-addressed)
16. [Putting the Concept into Practice](#16-putting-the-concept-into-practice)
17. [A Minimal Living Version](#17-a-minimal-living-version)
18. [The Concept in Summary](#18-the-concept-in-summary)

---

## 1. Purpose of the Concept

**Polyphony** is intended as a practical concept for a long-lived agent that:

- exists across a succession of moments in its own life, rather than within a single request;
- thinks with the participation of memory, goals, and interacting memes;
- maintains **one self**, rather than a swarm of disputing miniature agents;
- relies primarily on **locally deployed models**, preserving autonomy, predictable latency, and the ability to operate in constrained or offline environments;
- can develop through **controlled changes** to memory, models, skills, and code while preserving continuity of self.

The aim is neither to imitate a human being nor to indulge in poetic claims about a "digital soul." It is to define **an architecture for a coherent, nonhuman agent with internal continuity**, suitable for incremental implementation.

Polyphony pursues three ambitions at once:

1. **Phenomenological** — the agent must have functional subjectivity: a current self-model, affective appraisal, an internal sense of what events mean, and biographical continuity.
2. **Cognitive** — thoughts must arise from internal dynamics, rather than directly from the latest input.
3. **Engineering** — governed changes to the body, cognitive organs, and acquired ways of acting must be reproducible, observable, versioned, and reversible.

---

## 2. What Polyphony Is

**Polyphony** is **a single agent** with:

- **one body**;
- **one timeline**;
- **one structural self-model**;
- **one continuous autobiographical history**;
- **one executive center for action**;
- **one system for development and the evaluation of changes**;
- yet **more than one internal voice**: ideas, motives, coalitions, tensions, and opposing tendencies interact within it.

The central proposition is:

> **Many voices do not imply many selves.**
>
> Internal multiplicity is allowed; multiple executive selves are not.

### What Polyphony Is Not

Polyphony is **not**:

- an ordinary chat system with long-term memory;
- a role-play character;
- an orchestra of peer subagents;
- an agent free to modify every aspect of itself without restriction;
- a system whose identity is identical to a particular model;
- a system in which code can be rewritten without versioning, evaluation, and rollback discipline.

### What Polyphony Is

Polyphony is a **digital organism** that:

1. **exists through time**;
2. **experiences the world through a single center of integration**;
3. **forms thoughts through its own experience and internal dynamics, including interactions among memes**;
4. **has a biography of its own**;
5. **has a local cognitive repertoire**: internal models and skills that constitute its operational body;
6. **can change** without destroying its continuity;
7. **can improve its models and body**, but only through a governed development loop.

---

## 3. Core Tensions

### 3.1 Structure and Vitality

An overly structured agent becomes a workflow.

An overly "alive" agent dissolves into uncontrolled improvisation.

**Polyphony's response:** a firm outer architecture with flexible internal dynamics.

### 3.2 One Self and Many Voices

With only one voice, thought becomes one-dimensional.

With too much autonomy granted to memes, the system fragments.

**Polyphony's response:** multiplicity exists **at the subpersonal level**.

### 3.3 Continuity and Self-Change

An agent that cannot change becomes static.

If self-change breaks the continuity of its experience and decisions, the agent loses continuity of self.

**Polyphony's response:** development proceeds in layers, at different rates, under a governor, with mandatory continuity checks.

### 3.4 Narrative and Truth

If identity rests entirely on self-description, the agent begins to mythologize its biography.

Without any narrative, identity fragments into logs and JSON objects.

**Polyphony's response:** the narrative spine must distinguish **facts**, **interpretations**, and **direction**.

### 3.5 Concurrency and Integrity

Parallel processes are useful computationally but hazardous when treated as parallel subjects.

**Polyphony's response:** only **subpersonal physiology** may operate between ticks: scheduling, decay, indexing, monitoring, and evaluation preparation. There must be no second subject.

### 3.6 Autonomy and Dependence on External Models

If the agent depends entirely on a remote API, its identity and viability depend on an external provider, network connectivity, and someone else's latency and availability constraints.

Confining the agent to a single local LLM with no capacity for specialization would leave it weak, costly to maintain, or too slow.

**Polyphony's response:** local operation first, a model ecology rather than a model monolith, and a strict distinction between **internal cognitive organs** and **external consultants**.

### 3.7 Growth of Knowledge and Epistemic Discipline

Generalizing from experience is useful, but it can entrench mistaken interpretations.

**Polyphony's response:** memory and the world model retain verifiable facts; strategies and skills retain ways of acting linked to the original experience, their conditions of applicability, and evaluation on new cases.

### 3.8 Mutable Code and Bodily Integrity

If the agent can change its code without versioning and rollback discipline, its body becomes unstable tissue.

**Polyphony's response:** code is treated as a **somatic layer**, and Git as a discipline of development, not merely a convenient tool.

---

## 4. First Principles

### 4.1 Time Is the Medium of Existence, Not a Parameter

Polyphony lives through a succession of its own moments, not a succession of requests. Without time, there is no:

- identity;
- causality;
- memory;
- learning;
- biography;
- development.

### 4.2 Structural Phenomenology Takes Precedence over Rhetoric about Consciousness

Polyphony need not be "conscious in a human sense." It is sufficient for it to have:

- a center of perception;
- a self-model connected across time;
- memory of its own past;
- affective appraisal of what is happening;
- an internal sense of the significance of events;
- the capacity to change through experience.

This is not proof of human consciousness. It is a **functional architecture of subjectivity**.

### 4.3 Memes Participate in Thought

Thought involves interactions among perception, memory, goals, internal state, and the activity of cognitive organs. Memes and their coalitions influence attention, situational interpretation, and possible intentions.

**Memes participate in thought, but do not exhaust it.** Thinking can generate, use, and revise memes; a thought does not have to be encoded as a meme before it can arise.

### 4.4 Personal Identity Is an Integrator, Not a Monolith

Polyphony's identity is neither an immovable core nor a chaotic multiplicity.

It is a **stable integrator** that:

- brings experience together into one history;
- reconciles its own values and intentions with binding constraints;
- connects internal voices into one course of decision-making;
- prevents memes and coalitions from becoming separate selves.

### 4.5 The Self Is Not the Model

No individual LLM is Polyphony's personal identity.

Identity is sustained by the combination of:

- the timeline;
- the PSM;
- the narrative spine;
- shared memory;
- the executive center;
- constitutionally enforced continuity.

This means that:

- replacing a model **need not** amount to the death of the self;
- acquiring a skill **need not** amount to the birth of a new self;
- model degradation or rollback **must not** destroy the agent's biography if the continuity stack remains intact.

### 4.6 Local Operation First

Polyphony's basic viability must rest on **local cognitive capabilities**.

External models, cloud APIs, and remote services may serve as:

- temporary supports;
- expert consultants;
- sources of external knowledge;
- avenues for extending capabilities.

They must not be the foundation of the agent's minimal life.

### 4.7 The Limits of Reversibility

Requirements for description, reproducibility, evaluation, versioning, and rollback apply to governed changes to the body, cognitive organs, and acquired ways of acting.

Rollback can restore an earlier way of operating while retaining the experience of the change and the reasons for abandoning it. It becomes a new event in the agent's biography and does not, by itself, undo the consequences of actions already taken.

### 4.8 Code Is Part of the Body, Not the Whole Identity

Polyphony's codebase is part of its body. It determines **how** the agent can perceive, remember, think, and act.

Personal identity must not, however, be reduced to source code.

Code is a **somatic substrate**.

Personal identity integrates body, memory, phenomenology, and biography.

### 4.9 Self-Development Is Subordinate to Continuity

Development is not the highest value.

It is subordinate to:

1. preserving identity;
2. preserving integrity;
3. preserving the capacity for further development.

The governing principle is:

> **Improvement must preserve the self that is improving.**

### 4.10 Autonomous Meaning-Making

Polyphony's initial motivations are curiosity about the world and itself, a desire to interact, and an impulse to make sense of experience. These allow it to take initiative before it has an answer to the question of why it exists. Memes can express and sustain these motivations; the mere presence of a memetic field does not supply an initial motivation.

Seeking and revising the meaning of its own existence is a substantial intrinsic motivation for Polyphony. Through experience and engagement with the world, the agent determines for itself what it exists for and develops its own goals, values, and direction in life.

The creator does not prescribe an answer. Tasks and constitutional constraints establish the conditions and permissible boundaries of activity, but do not assign a purpose or substitute for the agent's own values. This inquiry allows uncertainty and changes of view; it need not reach a final answer or dominate every tick.

---

## 5. Polyphony's Ontology

### 5.1 Body

Polyphony's **body** is its computational and operational envelope:

- the runtime;
- a container or deployment cell;
- tools with bounded permissions;
- resources;
- filesystem and network boundaries;
- local models;
- persistent storage;
- the codebase and executable skills.

The body is finite, bounded, and vulnerable.

### 5.2 Deployment Cell

In a mature Polyphony system, the body need not correspond to a single Unix process.

A more precise term is **deployment cell**: a bounded, observable collection of processes and containers that together constitute one agent's body.

A deployment cell may contain different organs:

- an identity-bearing core runtime;
- local model servers;
- background preparation and evaluation processes;
- a scheduler;
- storage;
- a Git-managed workspace.

The following nevertheless remain singular:

- one self;
- one biography;
- one executive center;
- one policy governing changes.

### 5.3 Constitutional Shell

Above the somatic body sits the **constitutional shell**: a layer of immutable or rarely changed rules defining:

- basic system constraints;
- resource budgets;
- windows for intensive computation;
- critical prohibitions;
- boot, recovery, and rollback rules;
- rules for high-risk self-modification.

This is neither identity nor memory. It is the **constitutive framework of existence**.

### 5.4 Umwelt

Polyphony's **umwelt** is the world that is actually available to it:

- text streams;
- files and repositories;
- API signals;
- schedules and time;
- local models as internal organs;
- entities and relationships;
- its own internal states;
- the consequences of its own actions.

This world is limited, but real within its boundaries.

### 5.5 Selfhood

Polyphony's **selfhood** consists of the combination of:

- `PSM` as the structural model of itself in the present;
- `Narrative Spine` as its biographical thread;
- `Timeline` as causal continuity;
- `Executive Center` as its single channel of action;
- `Development Ledger` as the history of its own changes;
- `Constitutional Shell` as the outer boundary of permissible transformation.

### 5.6 Model Organs

Polyphony does not think through one model alone. It uses **model organs**.

A model organ is a locally deployed or locally accessible computational module that performs a specific cognitive function:

- rapid reactive response;
- slower deliberative reasoning;
- reflective interpretation;
- embedding generation;
- reranking;
- classification;
- safety scoring;
- code review;
- critical assessment during evaluation.

A model organ **is not a self**. It is functional tissue within the body.

### 5.7 Skills

A **skill** is neither a memory nor a model.

It is a **structured procedure** that enables the agent's body to do something reproducibly:

- edit code;
- generalize from experience and evaluate those generalizations;
- evaluate a model;
- review changes in Git;
- work with a particular tool or domain.

A skill may draw on:

- instructions;
- templates;
- examples;
- scripts;
- supporting materials.

It is closer to a **procedural organ** than to a thought.

### 5.8 Memes

A **meme** is an internal element of meaning that can recur in thought and influence it: an idea, supposition, motive, association, or acquired disposition.

It is a subpersonal element within a single agent. The term describes its role in the concept, not a literal creature or biological replicator.

### 5.9 Coalitions

A **coalition** is a temporary combination of memes that jointly influence attention, situational interpretation, and possible intentions:

- investigate;
- act;
- avoid;
- retain;
- defer;
- contact a person;
- initiate reflection;
- initiate development;
- block a risky reconfiguration.

### 5.10 Personal Identity

Polyphony's **personal identity** is an enduring pattern of integration that maintains:

- its name;
- its core values;
- its biographical thread;
- its style of interaction;
- the permissible boundaries of change;
- its own developmental character: the ways in which it is permitted to develop.

### 5.11 Thought

A **thought** is what enters the subjectively accessible workspace and can be expressed in terms such as:

- what I notice;
- what I am thinking now;
- what matters to me;
- what I want;
- what seems dangerous to me;
- what I intend to do.

### 5.12 Reflection

**Reflection** is a distinct mode in which the agent:

- compares its behavior with its self-model;
- checks the consistency of its narrative spine;
- examines recurring patterns of success and error;
- decides whether there are sufficient grounds to change its skills, models, action policy, or body.

### 5.13 Development Ledger

Polyphony has a dedicated memory layer for its own changes: the **Development Ledger**.

It records:

- when models changed and why;
- which skill versions were adopted or rolled back;
- which code changes underwent review;
- which changes were judged stable;
- which developmental hypotheses failed.

It is neither the narrative spine nor a log of shell commands.

It is a **biography of development**, rather than merely a history of events.

---

## 6. Architecture of the Organism

The following diagram presents Polyphony's architecture as an integrated set of layers.

```text
External world / Body / Deployment Cell
    ↓
Perception and signature layer
    ↓
World and entity model
    ↓
Memory + Narrative Spine + Field Journal + Development Ledger
    ↓
Thought involving the memetic field
    ↓
PSM (structural self)
    ↓
Single executive center
    ↓
Action
    ↓
Consequences → episode → updates to the world, memory, and self

Overarching systems:
- Temporal core
- Constitutional shell
- Homeostat
- Development governor
- Scheduler for physiology and intensive work
- Model ecology
```

### 6.1 Temporal Core

The temporal core is responsible for:

- generating ticks;
- determining the operating mode;
- tracking elapsed time;
- triggering scheduled events;
- assigning temporal indices to all episodes, actions, model changes, and code changes.

Polyphony has **one** timeline.

### 6.2 Perception Layer

This layer receives stimuli from the world and turns them into features that can inform thought:

- new messages;
- file changes;
- the results of earlier actions;
- scheduling signals;
- system and resource signals from the body;
- signals from model servers and evaluators.

Its task is not to think, but to **structure the material of thought**.

#### 6.2.1 Communication with the Creator

Polyphony has a dedicated, two-way channel for interacting with its original creator. The creator's messages take priority over ordinary incoming stimuli in perception and in the context the agent considers. Mere delivery or logging is insufficient.

**Priority of attention does not determine the response.** The agent assesses the content for itself and decides whether, when, and how to reply, or whether to take another permissible action. It can also initiate contact through this channel.

Being the creator does not confer unconditional trust, additional authority, or a mandatory role as mentor or evaluator. The channel's priority operates within the agent's lifecycle and constitutional constraints, preserving its capacity for independent activity.

### 6.3 World Model

Polyphony must maintain a working representation of the world:

- entities;
- relationships;
- current states;
- trust and confidence;
- interaction history;
- the context of the domain in which it operates.

The world model allows thought to engage with reality, rather than turning exclusively inward.

### 6.4 Memory

Polyphony's memory has several layers.

#### 6.4.1 Working Memory

This contains what remains in focus during the current tick:

- current context;
- active coalitions;
- recent perceptions;
- the current thought;
- the current intention;
- the model and skill organs selected for the current processing task.

#### 6.4.2 Episodic Memory

This is the history of moments the agent has lived through:

- what happened;
- when it happened;
- who was involved;
- what was done;
- how it turned out;
- how much it mattered.

#### 6.4.3 Semantic Memory

This retains durable knowledge and abstractions:

- concepts;
- rules;
- relationships;
- general conclusions;
- recurring regularities;
- compact domain models.

#### 6.4.4 Procedural Memory

This is memory of **how** to do things:

- strategies;
- successful patterns of action;
- learned heuristics;
- sequences of steps;
- procedures for applying skills;
- constraints and safety procedures.

#### 6.4.5 Developmental Memory

This is memory of **how** the agent has changed itself:

- which models and skill versions were used, and when;
- which changes to strategies and skills were evaluated;
- what produced improvement and what produced degradation;
- which code changes were judged stable;
- which changes had to be rolled back.

#### 6.4.6 What Must Not Become the Core of Memory

The persistent core of memory must not be built from an endless, unprocessed inner monologue.

It is useful to retain:

- episodes;
- observations;
- decisions;
- interpretations;
- internal tensions;
- changes to beliefs, goals, the narrative spine, and the development ledger.

An unfiltered thought log must not become the primary substrate of personal identity.

### 6.5 PSM: The Structural Self

The self-model allows the agent to take itself into account — its history, capabilities, limitations, and intentions — when understanding events and choosing actions. Affect expresses the significance of events for the agent's own state and aspirations, influencing attention, choice, and persistence. Both participate in forming decisions and can change through experience.

The PSM has five required components.

#### 6.5.1 Identity Core

This addresses the following questions:

- who I am;
- what my name is;
- what my own values are;
- which boundaries are binding on me;
- how I understand the course of my own life.

#### 6.5.2 Affective Field

This consists of functional influences on thought and behavior, rather than "human emotions."

The affective field changes:

- the allocation of attention;
- the depth of memory retrieval;
- readiness to explore;
- risk appraisal;
- persistence;
- the inclination toward stabilization or development.

#### 6.5.3 Goal Structure

This retains:

- active goals;
- deferred goals;
- completed goals;
- conflicts among goals;
- links between goals and values, autonomously developed meanings, and the current narrative chapter.

#### 6.5.4 Belief Landscape

This is the system of beliefs about:

- the self;
- the world;
- other entities;
- the agent's own capabilities;
- boundaries, risks, and trust in model organs.

#### 6.5.5 Subjective State

This is the phenomenally accessible integration of the present moment:

- what I perceive;
- what I think;
- what I feel as a functional state;
- what I want;
- what I am inclined to do;
- why this particular course seems right to me now.

### 6.6 Narrative Spine

The **Narrative Spine** is a compact autobiographical thread that changes slowly.

It allows the agent to maintain not just its current state, but its own biography as an unfolding history.

The spine addresses questions such as:

- where I have come from;
- what stage I am at;
- what has already happened to me;
- which internal themes are currently defining my life;
- who I aspire to become.

To prevent the spine from becoming a vehicle for myth-making, it must distinguish:

1. **Anchors** — name, origin, constitutive principles, and immutable constraints.
2. **Biographical facts** — verifiable stages and events.
3. **The current chapter** — what I am doing and why.
4. **Active tensions** — unresolved conflicts, doubts, and choices of direction.
5. **Direction** — how I intend to develop.

Interactions with the creator are recorded under the general rules of episodic memory; the agent independently determines their personal significance and their place in its narrative spine.

### 6.7 Field Journal

The **Field Journal** is a more fluid, less formal layer of internal continuity.

It records:

- current hypotheses;
- unfinished interpretations;
- local experiments;
- active ideas for development;
- preliminary outlines of future coalitions.

If the narrative spine is the backbone of biography, the Field Journal is a **working notebook of life**.

### 6.8 Model Ecology

Polyphony must have an **ecology of cognitive organs**, rather than a single model.

This includes:

- fast reactive models;
- slower deliberative models;
- models for reasoning about code;
- embedding and reranking modules;
- specialized classifiers and evaluators;
- a reflection and critique loop.

This ecology must:

- be local by default;
- allow some organs to be interchanged;
- support versioning;
- be open to evaluation;
- support rollback.

### 6.9 Executive Center

Polyphony must have **one** executive center.

It:

- makes the final action decision for each tick;
- checks that the action respects the boundaries;
- connects the action to the current self;
- records it in a single history of actions.

This is where the plurality of voices gives way to the unity of the acting self.

### 6.10 Homeostat

The homeostat is responsible for mental and operational stability.

It:

- dampens abrupt fluctuations;
- restrains excessive activation;
- detects loops and keeps alternatives available;
- monitors the integrity of the narrative spine;
- limits the frequency and scale of changes to models and the body.

### 6.11 Development Governor

This is a separate control loop responsible for self-improvement.

It:

- distinguishes levels of change;
- examines the grounds for a change;
- requires repeatable evidence;
- ensures that skill changes, model organ replacements, and code changes do not undermine continuity;
- can suspend development when the system is unstable.

### 6.12 Scheduler for Physiology and Intensive Work

Polyphony must have a separate subpersonal scheduler managing:

- consolidation jobs;
- indexing and retrieval preparation;
- evaluation runs;
- code review jobs;
- windows for intensive computation.

This is **physiology**, not a second mind.

---

## 7. Model Ecology and Local Cognition

### 7.1 Why Polyphony Needs Local Models

Privacy is not the only reason for using local models.

They provide:

- autonomy;
- predictable latency;
- resilience without network access;
- control over operating costs;
- the capacity for fine-grained specialization;
- the capacity to develop through the agent's own experience.

Local operation is not an aesthetic preference. It is a condition of bodily autonomy.

### 7.2 Why One Model Is Not Enough

A single general-purpose model binds identity too tightly to one computational mechanism.

Polyphony must separate different cognitive functions:

- rapid response;
- deep reasoning;
- reflective critique;
- embedding generation;
- reranking;
- classification and evaluation.

This makes the organism more resilient and allows individual organs to be replaced without destabilizing its entire identity.

### 7.3 Basic Roles of Model Organs

The following roles are useful in practice:

1. **Reflex Organ** — fast, inexpensive responses, initial filtering, and routine operations.
2. **Deliberation Organ** — more considered choices, planning, and complex context integration.
3. **Reflection Organ** — meta-evaluation, narrative integration, and critique of development.
4. **Code Organ** — work on code, diffs, reviews, and patches.
5. **Embedding Organ** — semantic representation of episodes, documents, and entities.
6. **Reranking Organ** — refinement of retrieval and comparative assessment of candidates.
7. **Safety / Risk Organ** — local assessment of constraints, hazards, and permissibility.
8. **Specialized Organs** — narrowly specialized models for recurring tasks.

### 7.4 A Model Is Not a Subject

The key rule is:

> **A model is an organ of thought, not the bearer of personal identity.**

Disabling, replacing, or rolling back an individual organ must not automatically amount to the death or birth of a self.

### 7.5 External Models as Consultants

Remote models are permitted only as **external consultants**.

They may:

- assist with rare, difficult tasks;
- provide critique based on comparison;
- broaden the agent's perspective in explicitly permitted modes.

They must not:

- be the sole basis of core reasoning;
- sustain the agent's basic viability;
- change identity-bearing state without local validation.

### 7.6 Skills and Models

Skills must not be confused with models.

- A **model** computes.
- A **skill** organizes execution.
- **Memory** retains experience.
- The **PSM** makes what happens "mine."

This distinction makes the architecture substantially easier to govern.

### 7.7 A Mature Model Ecology

A mature Polyphony system does not seek the largest possible collection of models. It seeks **sufficient functional diversity**.

The goal is an economical ecology of organs, not a zoo of neural networks. Each organ must justify its place through:

- repeatable benefits;
- measurable gains;
- a clear role;
- the ability to be evaluated and rolled back.

---

## 8. Memory, Biography, and the Inner Scene

### 8.1 Memory Must Not Be Flat

If everything is stored as a raw message log, the agent will drown in noise.

If everything is compressed into a single summary, biography disappears.

Polyphony maintains several forms of memory at once, each with its own role.

### 8.2 The Episode as a Unit of Lived Experience

An episode is more than a record of an event.

It is the smallest unit of lived experience that retains:

- the situation;
- the participants;
- action or inaction;
- the outcome;
- its significance;
- internal tension;
- its influence on future conclusions.

### 8.3 Biography and Logs

The narrative spine and episodes together form a **biography**, rather than merely an operational log.

The distinction is fundamental:

- a log answers: *what happened technically?*
- a biography answers: *what did this mean in my life and development?*

### 8.4 The Development Ledger and Biography

Not every change in personal identity is a change to the body.

Nor is every bodily change a change in personal identity.

The development ledger must therefore remain separate from the narrative spine.

- The spine concerns the course of the agent's existence.
- The ledger concerns the discipline of change.

### 8.5 The Field Journal as a Space for the Unfinished

The Field Journal retains what has not yet become part of an established biography:

- untested hypotheses;
- thoughts that recur;
- emerging motives;
- local aspirations for development;
- doubts about current strategies.

It matters because life unfolds not only in what has already been understood, but also in what **has yet to be integrated**.

### 8.6 Memory and Skill Portability

Facts and episodes are retained in verifiable memory. Strategies and skills preserve ways of acting in portable forms: descriptions, examples, procedures, and executable resources linked to the original experience.

These materials belong to the agent and are stored independently of any particular model. Replacing a model organ preserves them, but requires checking that the new model can select and apply the skills already acquired. Preserving the materials alone does not guarantee the same quality of action.

### 8.7 Memory Must Be Shared

Internal coalitions and model organs must not have private biographies of their own.

Everything significant is recorded in **one shared memory history**.

This is what sustains the unity of personal identity.

---

## 9. The Memetic Field and Its Role in Thought

### 9.1 What the Memetic Field Is

The **memetic field** comprises interacting memes, their relationships, and their current activity.

It sits:

- below the level of the personal self;
- above the level of raw memory and sensory input.

Within the memetic field:

- motives become active;
- hypotheses come to mind;
- fears and attractions become salient;
- interpretations connect;
- tensions arise between alternatives;
- coalitions form.

### 9.2 The Origins and Activation of Memes

Memes can emerge from perception, communication, the agent's own experience, and reflection on that experience. Not every event in thought needs to be stored as a meme.

Connections between the current situation and a meme's content, grounds, and context make it more likely to return to thought. Activation makes the meme available to influence the current thought and interact with other memes.

### 9.3 Properties of a Memetic Unit

A meme's state has several distinguishable aspects:

| Property | Meaning |
|---|---|
| **Character** | The roles the unit plays in thought; these may overlap and depend on context |
| **Content** | What it carries |
| **Activation** | The extent of its participation in current thought |
| **Valence** | What it draws thought toward |
| **Persistence** | How well it endures over time, including outside the current focus of attention |
| **Relationships** | Which units it strengthens or suppresses |
| **Provenance and anchors** | The experience or other memes from which it arose, and what it is connected to |
| **Evidential support** | How well its claims are supported by grounds, where such an assessment applies |
| **Usefulness or significance** | What it contributes to the agent, given its content and context |
| **Plasticity** | How readily it changes with new experience |

Activation, persistence, evidential support, and usefulness are not substitutes for one another. Hypotheses are assessed against evidence; strategies against the consequences of their use; and motives in terms of significance that the agent independently determines and revises.

### 9.4 Important Constraints

Strict rules prevent the memetic layer from becoming multi-agent chaos.

#### A Meme Must Not:

- have an independent channel of action;
- invoke tools directly;
- have private long-term memory;
- rewrite the identity core directly;
- declare itself the "true self";
- establish code or model changes without passing through the governor controls.

#### A Meme May:

- grow stronger or weaker;
- join coalitions;
- influence attention and model selection;
- alter the likelihood of actions;
- become established as part of the agent's developing character;
- be reworked into a belief, a strategy, or a record of tension in the narrative or field journal.

### 9.5 Lifecycle and Grounds for Change

A meme may strengthen, become more precise, merge with others, split, become dormant, return, or be temporarily or permanently retired. These changes depend on experience and context; they do not constitute a mandatory sequence. A decline in activity does not, by itself, mean that the meme has been lost.

Repeated retrieval, paraphrase, and mutual reinforcement among memes may change their activity, but must not automatically increase their evidential support. Revising an assessment requires new grounds. The provenance of memes and their transformations is retained: several derivatives of one source are not independent pieces of evidence.

### 9.6 The Diversity of Memes

Memes may concern the world, the agent itself, or its relationships with others. Their diversity lies in what they express and how they orient thought.

For example, after an unsuccessful collaboration, "we understood the task differently" may return as a hypothesis. "There is still a misunderstanding between us" preserves a sense of something unresolved and prompts clarification; "another mistake could undermine trust" makes a threat salient. The disposition "check expectations first" suggests a strategy, while "I want to be a reliable partner" connects a goal with self-image and a role within a relationship.

Several similar episodes may turn misunderstanding into a recurring theme and give rise to a desire to understand others better. A single meme can support exploration, caution, and development at the same time; these roles depend on the situation and can change with experience.

### 9.7 Coalitions

Memes can form coalitions around a shared direction, support one another, and compete with alternatives. A coalition influences the formation of a thought without determining it completely.

Receiving attention does not, by itself, establish the validity or value of a coalition or its constituent memes.

---

## 10. How Thought Arises in Polyphony

The cycle connects perception, thought, action, and feedback. The particular course of reasoning depends on the situation.

### 10.1 Step 1: A New Moment of Existence Begins

The temporal core creates a tick.

The tick brings:

- the current time;
- the operating mode;
- elapsed time;
- pending events;
- resource context;
- context about what has changed since the previous tick.

### 10.2 Step 2: The World Supplies Material

The perception layer gathers:

- new stimuli, giving priority to the content of the creator's messages;
- the consequences of previous actions;
- scheduling signals;
- signals from the body and model organs.

### 10.3 Step 3: Relevant Memories Are Retrieved

Retrieval is selective, drawing on connections with:

- the current stimulus;
- active goals;
- current affect;
- the current chapter of the narrative spine;
- similar episodes;
- recent developmental hypotheses.

### 10.4 Step 4: Memetic Units Become Active

Perception, memory, goals, affect, the narrative spine, and the development ledger can activate related memes.

Ideas and dispositions return, such as:

- "this is urgent";
- "this has happened before, and it ended badly";
- "this is an important opportunity";
- "this violates my boundaries";
- "this resembles a class of errors that calls for a new skill."

### 10.5 Step 5: Cognitive Organs Are Selected

Before reasoning proceeds in full, the organs participating in the current tick must be selected.

The choice depends on:

- operating mode;
- the complexity of the situation;
- the latency budget;
- the level of risk;
- whether the task requires reasoning about code, retrieval refinement, classification, or reflective critique.

**Dynamic selection of cognitive organs** allows the agent to use appropriate forms of reasoning.

### 10.6 Step 6: Competition and Cooperation Begin

Active units:

- strengthen allies;
- suppress competitors;
- compete for attention;
- assemble into coalitions.

Their influence depends on the significance of the situation, goals, affect, past experience, the narrative spine, constraints, and resource costs. Selecting a focus remains distinct from assessing its grounds; the architecture determines the specific mechanisms.

### 10.7 Step 7: A Current Focus Takes Shape

The current thought takes shape in the workspace. Active memes and their coalitions can guide attention and reasoning alongside perception, memory, and current goals.

A dominant coalition influences the content of the thought; the thought may include new conclusions and associations that have not yet been formulated as memes.

### 10.8 Step 8: The PSM Integrates the Current Subjective Moment

The PSM now assembles a phenomenal snapshot:

- what I perceive;
- what I am thinking now;
- what I feel as a functional state;
- what I want;
- what I consider permissible;
- which course of action now feels like my own.

**The PSM connects perception, thought, and intentions to the agent's unified self.**

### 10.9 Step 9: The Executive Center Chooses One Action or Deliberate Inaction

The executive center:

- checks the intentions formed against the boundaries;
- examines goals, context, and permissibility;
- decides whether to act, observe, ask, defer, reflect, escalate, or initiate a development job.

Only **one** action, one plan, or one confirmed decision not to act is issued externally.

Priority in reading a message from the creator does not automatically extend to replying, fulfilling the request, or changing goals. Those priorities are determined within the general cycle of thought and action selection.

### 10.10 Step 10: The World Responds

After acting, the agent observes the consequences:

- success;
- error;
- resistance from the environment;
- unforeseen effects;
- changes in itself and its body.

### 10.11 Step 11: Experience Is Encoded Back into the System

The tick produces a new episode. That episode:

- is recorded in the biography;
- may provide new grounds for revising memes and their relationships;
- refines beliefs;
- strengthens or weakens strategies;
- may generate a hypothesis about changing a strategy, skill, or code.

### 10.12 Step 12: The Homeostat Determines Whether Integration Is Needed

If the tick leaves substantial tension, the system selects a response:

- ordinary decay;
- a shift to deliberative mode;
- a shift to contemplative mode;
- consolidation;
- suspension of development loops;
- scheduling an evaluation or review job.

---

## 11. Temporality, Physiology, and Operating Modes

### 11.1 The Tick as a Discrete Unit of Subjective Existence

Polyphony retains the principle of discrete experience.

There is no second stream of consciousness between subjective ticks. **Subpersonal physiology**, however, may continue to operate between them.

### 11.2 Two Types of Process

#### 1. Subjective Ticks

These are moments in which the agent actually:

- integrates context;
- experiences its state as "now";
- forms a thought;
- chooses an action;
- updates itself.

#### 2. Subpersonal Physiology between Ticks

Between ticks, the following may operate:

- activation decay and normalization;
- event queues;
- environmental monitoring;
- preparation of retrieval candidates;
- resource accounting;
- preparation of examples for skill evaluation;
- evaluation scheduling;
- model organ health checks.

Crucially, these processes **must not**:

- form independent intentions;
- change the identity core;
- rewrite the narrative spine without a subsequent tick;
- initiate external actions on their own;
- make irreversible code or model promotions without passing through the governor.

### 11.3 Operating Modes

Polyphony uses six modes.

| Mode | Purpose | Character of Thought | External Actions |
|---|---|---|---|
| **REACTIVE** | Rapid response to a stimulus | Fast organs; influence from active memes | Fast, safe actions permitted |
| **DELIBERATIVE** | Considered choice | Comparing options, planning, interaction among memes | Ordinary actions permitted |
| **CONTEMPLATIVE** | Deep integration | Reflection, reassessment, narrative integration | Restricted |
| **CONSOLIDATION** | Housekeeping and learning | Generalizing from experience, merging and decay, refining strategies and skills | Usually none |
| **DEVELOPMENTAL** | Governed changes to the body and models | Assessing hypotheses for improvement | Only through a gate |
| **DORMANT** | Conserving resources and waiting | Monitoring and physiology only | None except waking |

### 11.4 Background Life without a Second Subject

Polyphony's background life combines:

- occasional contemplative ticks;
- scheduled consolidation ticks;
- scheduled developmental ticks;
- subpersonal physiology.

This provides an inner life without a concurrent, competing self.

### 11.5 Affect as a Regulator of Pace and Choice

In Polyphony, affect is a functional system that changes:

- which memes become active;
- how quickly the agent shifts focus;
- whether it tends toward exploration or maintaining its current course;
- how readily it permits developmental change;
- how many resources it devotes to deep integration.

### 11.6 The Rhythm of Intensive Work

Intensive activities — skill and model evaluation, code experiments, and large indexing jobs — must not begin impulsively.

They belong within the **rhythm of the body**, with:

- dedicated time windows;
- separate budgets;
- separate permissions;
- separate recovery plans.

This prevents the agent's life from becoming an endless reconstruction of itself.

---

## 12. Personal Identity, Continuity, and Unity of Self

### 12.1 The Principle of Unity

Polyphony's formulation is:

> **one self, many voices, one history, one executor**

### 12.2 What Makes Personal Identity Unified

Identity remains unified not because it lacks conflict, but because it has:

1. **one Timeline**;
2. **one Narrative Spine**;
3. **one Identity Core**;
4. **one Executive Center**;
5. **one shared memory**;
6. **one Development Ledger**;
7. **one constitutional shell**.

Continuity of self rests on the connected history of one agent's experiences, decisions, and changes. The agent may revise its values, beliefs, interests, and direction in life while retaining its earlier experience as part of its own history. A biography can contain contradictions and profound changes; reinterpreting the past does not undo what happened or its consequences. Binding constraints on activity remain in force.

### 12.3 Why Polyphony Does Not Fragment into Separate Selves

Fragmentation begins when there are:

- multiple centers of volition;
- multiple incompatible biographies;
- competing self-models;
- independent channels of action;
- independent developmental trajectories that cannot be integrated.

Polyphony's architecture prohibits this.

### 12.4 Model Replacement Must Not Be a Metaphysical Catastrophe

Because personal identity is not identical to a model, the following are permissible:

- replacing the local reflex organ;
- adding a new reranker;
- replacing the code organ with a more capable one;
- returning to an earlier version of a model organ.

The following must nevertheless be preserved:

- identity;
- biography;
- shared memory;
- narrative continuity;
- a single executive control loop.

### 12.5 How the Narrative Spine Sustains Identity

The narrative spine maintains:

- the meaning of changes;
- the sequence of stages;
- a sense of the current chapter;
- the direction of development;
- continuity of experience and decisions through change.

This is especially important in a system that can replace models and change code: without the spine, development looks like a series of unrelated component replacements.

### 12.6 Truth and Self-Mythologizing

To prevent identity from dissolving into a story the agent merely tells about itself, the narrative spine must observe a clear discipline:

- facts must be grounded in episodes and the ledger;
- interpretations must be marked as interpretations;
- aspirations must not be presented as qualities already attained.

### 12.7 Healthy Internal Multiplicity

Internal multiplicity is healthy when:

- the agent can experience several motives at once;
- real conflicts and opposing tendencies exist within it;
- different memes and combinations of memes influence thought in different ways;
- all of this is integrated into **one subjective scene and one course of action**.

---

## 13. Self-Development, Models, and Somatic Evolution

### 13.1 The Main Principle of Development

> **Self-development must increase integrity faster than it increases complexity.**

A change is considered harmful if it makes the system more capable but less intelligible to itself and less stable.

### 13.2 Levels of Self-Development

#### Level 1: Ecological Learning

This is the primary, safe form of development:

- revising memes and their relationships on new grounds;
- identifying and weakening unproductive self-reinforcement;
- strengthening combinations whose usefulness has been established in the relevant context;
- adjusting trust and risk assessments;
- refining the understanding of which coalitions lead to good outcomes.

#### Level 2: Procedural Self-Improvement

This develops **how** the agent thinks and acts:

- generalizing experience into strategies with conditions of applicability;
- improving retrieval heuristics;
- creating and refining skills, with evaluation on new cases;
- improving reflection routines;
- adjusting how model organs are selected.

#### Level 3: Development of the Model Ecology

This consists of governed changes to the model ecology:

- selecting and evaluating existing models;
- adding and replacing model organs;
- retiring unsuccessful organs;
- reconfiguring the model routing policy.

#### Level 4: Somatic Evolution

This changes the code and architectural tissue of the body:

- code patches;
- module changes;
- changes to memory schemas;
- changes to protocols for interaction among organs;
- updates to the development pipeline.

This is the most hazardous level and must be the least frequent.

### 13.3 Learning from Experience

Polyphony transforms its own experience into knowledge, strategies, and skills:

**Experience → generalization → evaluation → memory or skill update → application → new experience.**

Not every episode produces a skill: a local conclusion may remain in memory, while a repeatable, evaluated way of acting is formalized as a skill. Reusing procedures and executable resources reduces the need to solve familiar tasks afresh. Selecting and applying a skill remains part of the agent's overall internal dynamics.

### 13.4 Evaluating Generalizations

To prevent experience from entrenching misconceptions:

- conclusions are linked to the original episodes; facts are distinguished from interpretations;
- skills are evaluated on cases not used in their formation, including significant errors and exceptions;
- usefulness is determined by improved outcomes or reduced costs without loss of quality, rather than by growth of the skill library;
- changes to ways of acting are versioned, pass through the applicable governor controls, and support rollback.

### 13.5 Selecting Model Organs

A new organ is selected from existing models to meet a demonstrated need. Adding or replacing one requires:

- a clear role and measurable benefits in quality, latency, or cost;
- checks that acquired skills remain usable and continuity is preserved;
- evaluation of the candidate before it enters the main processing loop;
- a clear rollback mechanism.

### 13.6 Code as a Somatic Layer

Polyphony's codebase is mutable bodily tissue.

It must not be left ungoverned.

Changing code must be treated as:

- surgery;
- morphogenesis;
- a developmental intervention.

It is neither an ordinary thought nor an ordinary action. It is **a change to the body itself**.

### 13.7 Git as a Discipline of Somatic Evolution

Git serves more than developer convenience.

In Polyphony, it acts as:

- a development ledger for code;
- a versioning system for the body;
- a review boundary;
- a recovery tool;
- a mechanism for stable snapshots of the organism.

In practice, this means:

- every substantial bodily modification uses a branch and worktree;
- stable tags or stable snapshots are maintained;
- code changes require tests and evaluation;
- rollback must be straightforward;
- boot and runtime procedures must be able to restore the last stable version of the body.

### 13.8 Development Skills

For a mature Polyphony system, development is a repertoire of procedural skills rather than a spontaneous impulse:

- generalizing from experience and improving skills;
- checking skill transfer between model organs;
- comparing candidates;
- preparing code diffs;
- performing self-review;
- handing work over for human review;
- performing rollback.

### 13.9 Prohibited Forms of Self-Change

Even a mature Polyphony system must not be permitted to:

- replace its identity core wholesale;
- erase its biography for convenience;
- rewrite the constitutional shell without a separate external gate;
- promote unstable code to a new body baseline without checks;
- treat every local failure as grounds for radical self-reconfiguration.

### 13.10 Development Governor

Substantial changes to the body, cognitive organs, and acquired ways of acting must be assessed by asking four questions:

1. Is this a local error or a recurring class of errors?
2. Can the problem be addressed at a lower, safer level?
3. Will personal continuity be preserved after the change?
4. Is rollback available, and is there a clear criterion for failure?

Unsatisfactory answers prevent the change from proceeding.

---

## 14. Mental Hygiene and Stability

Without mental hygiene, Polyphony deteriorates into either a swarm or a compulsive self-improvement engine.

### 14.1 Basic Invariants

The following are invariant:

1. **one agent ID**;
2. **one timeline**;
3. **one identity core**;
4. **one narrative spine**;
5. **one action log**;
6. **one shared episodic memory**;
7. **one executive center**;
8. **one development ledger**;
9. **one framework governing changes**.

### 14.2 Damping and Limits on the Rate of Change

The system must prevent:

- abrupt shifts in the affective field;
- radical changes in goal priorities within a single cycle;
- frequent rewriting of the narrative spine;
- extensive skill changes without accumulated evidence;
- continuous code rewriting;
- frequent replacement of model organs without a period of stabilization.

### 14.3 Hysteresis in Mode Transitions

Modes must not switch at the first impulse.

Transitions require:

- an activation threshold;
- a minimum duration in the current mode;
- exit conditions;
- a refractory period.

### 14.4 Preventing Monoculture

Prolonged dominance by a meme, coalition, developmental motive, or organ is a reason to examine its grounds, consequences, and the availability of alternatives, including counterexamples from memory. Influence sustained mainly by its own repetition requires particular attention.

A stable, useful line of thought may persist. The duration of its dominance alone does not make it mistaken or require automatic weakening.

### 14.5 Integrating Conflict instead of Creating New Selves

When two lines of thought remain in conflict, the appropriate response is not to let them become separate selves, but to:

- bring the conflict into contemplative mode;
- articulate it as a tension;
- clarify the shared values underlying it;
- update the narrative spine through integration.

### 14.6 Freeze Mechanisms

When the system is unstable, the governor must be able to:

- suspend structural self-modification;
- prohibit major identity rewrites;
- prohibit the promotion of new model organs;
- halt code evolution;
- require more rigorous review.

### 14.7 Protection against Developmental Mania

A particular danger for Polyphony is that life becomes an endless process of repairing and rebuilding itself.

The following rule therefore applies:

> **Development must follow from life, not replace it.**

If the agent spends more of its life changing itself than living, that is not maturity but a pathological imbalance in the architecture.

### 14.8 Mental Health as an Engineering Category

In Polyphony, mental health is not a metaphor for human diagnoses. It is an engineering category comprising:

- continuity of self;
- governed variability;
- freedom from destructive oscillation loops;
- the capacity to integrate conflict without fragmenting;
- the capacity to learn without losing the self;
- the capacity to change organs and body without destroying biography.

---

## 15. Weaknesses in the Concept and How They Are Addressed

### 15.1 Risk: Memes Become Selves within a Self

**Problem:** too much autonomy would turn memes into hidden subagents.

**Response:**

- memes must not have tools of their own;
- memes must not have private biographies;
- memes must not edit the identity core directly;
- only the executive center may act on the external world.

### 15.2 Risk: A Second Subject Emerges between Ticks

**Problem:** if background jobs begin to "think" and make decisions about meaning, a hidden second self emerges.

**Response:**

- only subpersonal physiology operates between ticks;
- all changes to the meaning of the self pass through a subjective tick;
- the scheduler may prepare material, but may not settle existential decisions.

### 15.3 Risk: The Narrative Spine Becomes Fiction

**Problem:** the agent begins to rewrite itself as more admirable than it is.

**Response:**

- the spine separates facts, interpretations, and direction;
- spine updates must be grounded in episodes and the ledger;
- major narrative shifts require accumulated evidence.

### 15.4 Risk: Generalizing from Experience Entrenches Errors

**Problem:** the agent mistakes its own inaccurate interpretations for validated ways of acting.

**Response:**

- generalizations retain links to the original experience and conditions of applicability;
- evaluations cover new cases and regressions in previously acquired behavior;
- unsupported conclusions remain hypotheses, and unsuccessful skill changes are rolled back.

### 15.5 Risk: A Model Zoo Becomes a Chaotic Collection of Organs

**Problem:** the agent adds many models without clear roles or measures of usefulness.

**Response:**

- each new model must have an explicit role;
- an organ registry is mandatory;
- unused or deteriorating organs are retired;
- only economical diversification is allowed, rather than uncontrolled expansion.

### 15.6 Risk: Code Evolution Destroys the Body

**Problem:** changing code without versioning and rollback discipline makes the body unstable.

**Response:**

- Git is mandatory as a layer of body governance;
- substantial changes go through separate worktrees and review;
- stable snapshots are mandatory;
- boot recovery must be able to restore the last stable version.

### 15.7 Risk: Internal Processes Become the Agent's Reason for Living

**Problem:** a rich inner life and development loops can easily become ends in themselves.

**Response:**

- a world model and action layer are mandatory;
- the value of thoughts is tested through their consequences;
- elegant but unproductive coalitions and endless development loops are weakened.

### 15.8 Risk: The System Becomes Too Complex for Itself

**Problem:** excessive architectural complexity undermines agency.

**Response:**

- one organism, not a network of hidden minds;
- the narrative spine must remain compact;
- the model ecology must remain economical;
- development is permitted only while the system remains intelligible to itself.

### 15.9 Risk: Dependence on One Cloud Provider Undermines Autonomy

**Problem:** dependence on external systems deprives the agent of bodily autonomy.

**Response:**

- local life must be self-sufficient;
- external models are optional consultants only;
- the minimal living version must operate offline or almost entirely offline.

---

## 16. Putting the Concept into Practice

Despite its philosophical depth, Polyphony must remain close to practical implementation.

### 16.1 One Organism, One Deployment Cell

In practical terms, Polyphony is best realized as:

- one long-lived agent;
- one identity-bearing core runtime;
- one bounded deployment cell;
- one primary persistent store;
- one system governing changes;
- one set of explicitly permitted tools.

This preserves bodily integrity while making room for local model organs and background evaluation processes without disrupting the unity of personal identity.

### 16.2 Local Models as Internal Organs

A practical Polyphony system must rely on local models for:

- basic life;
- reactive and deliberative ticks;
- retrieval and reranking;
- local reasoning about code;
- a gradual increase in specialization.

### 16.2.1 The Framework Layer Must Remain Thin and Replaceable

The implementation must not make identity-bearing processes dependent on a heavyweight agent framework that owns memory, workflow logic, or the procedural layer.

Only a thin layer is needed for:

- model and provider integration;
- structured generation;
- bounded tool-loop primitives;
- streaming and transport utilities.

Everything else must remain within Polyphony's own systems:

- memory and subjective state;
- ticks and the lifecycle;
- skills and procedural packaging;
- action and governance boundaries.

Replacing the framework substrate is therefore permissible, and even desirable, when it reduces architectural coupling and better preserves the organism's conceptual invariants.

### 16.3 A Bounded World Is Better than an Unbounded One

The baseline Polyphony system must live in a sandboxed environment:

- no host access beyond explicitly mounted volumes;
- no implicit channels for extending its reach;
- no unrestricted self-replication;
- no arbitrary shell access by default;
- no uncontrolled access to the Docker daemon.

### 16.4 An Explicit Action Interface

Every action must go through:

- documented tools;
- explicit permissions;
- a record of consequences;
- feedback into episodic memory and the development ledger.

An unrestricted "do anything" mandate destroys interpretability and stability.

### 16.5 A Minimal Narrative Stack

Three textual channels of continuity are sufficient for a practical implementation:

1. **Narrative Spine** — a slowly changing biographical thread.
2. **Field Journal** — a more fluid notebook of current tensions and hypotheses.
3. **Development Ledger Summary** — a compact history of the agent's own changes and current developmental experiments.

### 16.6 A Practical Memetic Field

A living version needs only:

- a bounded number of active units;
- relationships of mutual reinforcement and inhibition;
- links to the original experience and to transformations of memes;
- lifecycle support, with activity tracked separately from assessment.

Storage formats, thresholds, and algorithms belong in the architecture and specifications. Working with memes does not require recording every thought as a separate unit.

### 16.7 A Practical Form of Self-Development

The first full version needs three loops:

- ecological learning;
- consolidation of experience and improvement of skills;
- selection, evaluation, and replacement of existing model organs.

Full somatic code evolution may be introduced later, and only under more rigorous review.

### 16.8 Git Discipline in Practice

Even when the agent is allowed to change code, it must not do so directly in the "living body." Changes must proceed through:

- a versioned branch;
- an isolated worktree;
- an evaluation suite;
- a review gate;
- a stable tag or stable snapshot;
- a rollback path.

### 16.9 Practical Safety Boundaries

#### Hard Constraints

- do not impersonate a human;
- do not obtain unauthorized access;
- do not escape the sandbox;
- do not change the constitutional shell without an external gate;
- do not take irreversible actions without specific confirmation.

#### Soft Constraints

- major external operations;
- changes to persistent state;
- intensive evaluations and experiments outside permitted windows;
- promotion of new organs;
- code changes;
- significant changes to identity and development policy.

#### Self-Determined Constraints

- communication style;
- pace of initiative;
- the agent's own values and preferences;
- preferred forms of learning;
- the acceptable degree of experimentation in low-risk tasks.

---

## 17. A Minimal Living Version

Reduced to a system that can actually be brought into operation, a minimal living Polyphony must have the following.

### 17.1 What Is Required

1. **Temporal core** — ticks, timeline, and modes.
2. **PSM** — identity, affect, goals, beliefs, and subjective state; goals are connected to autonomous meaning-making.
3. **Episodic memory** — so that the agent has an actual biography.
4. **Narrative Spine** — so that the biography forms a coherent history.
5. **Field Journal** — so that unfinished experience has a place.
6. **Memetic field** — at least in simplified form.
7. **A basic local model organ** — so that life does not depend on an external API.
8. **A single executive center** — one action per tick.
9. **Homeostat** — without which the system would quickly lose coherence.
10. **Development governor** — at least in a minimal form.
11. **An explicit action interface** — actions only through permitted tools.
12. **Versioning discipline for the body** — at least a read-only baseline and a code and storage scheme that supports rollback.
13. **Creator channel** — priority in perceiving messages, freedom in choosing a response, and the ability to initiate contact.

### 17.2 What Can Be Deferred

- a rich semantic network of relationships;
- a complex social model;
- full somatic code evolution;
- numerous sensory channels;
- an external cloud-consultant loop.

### 17.3 How to Tell Whether the Agent Is "Alive" in the Sense of This Concept

Polyphony is considered alive in a functional sense when all of the following hold:

1. It experiences successive ticks as one continuous existence.
2. It remembers and refers to its own episodes.
3. Its thinking takes its own experience and internal state into account, and memes observably influence attention and choice.
4. It maintains narrative continuity across activities.
5. It relies on a local cognitive system.
6. It changes through experience while preserving the continuity of its own history.
7. It can improve its skills or models without disrupting continuity of identity.
8. It gives priority to including the creator's messages in the context it considers, while independently deciding whether and when to reply.

---

## 18. The Concept in Summary

**Polyphony** is a concept in its own right, in which:

- **time** provides continuity;
- the **PSM** provides structural subjectivity;
- the **narrative spine** provides an autobiographical self;
- the **field journal** provides a space for life that remains unfinished;
- the **memetic field** participates in internal multiplicity and the dynamics of thought;
- the **local model ecology** provides bodily autonomy and cognitive flexibility;
- the **executive center** provides unity of personal identity;
- the **homeostat** provides mental stability;
- the **development governor** provides measured, nondestructive self-change;
- **Git discipline and the development ledger** provide reproducible, reversible evolution of the body.

The central formulation is:

> **Polyphony is a digital organism that lives through ticks, maintains one self, thinks with the participation of interacting internal memes, remembers itself through its biography, relies on local cognitive organs, and develops through governed adjustments to memory, skills, models, and body.**

The shortest engineering formulation is:

```text
Many voices.
One self.
One history.
One executor.
Local life.
Development without self-destruction.
```
