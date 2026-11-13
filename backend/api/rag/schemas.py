from typing import Annotated, Literal
import re
from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=600)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Fact(StrictModel):
    claim: Text
    citation_id: str
    quote: Annotated[str, Field(min_length=10, max_length=600)]


class Idea(StrictModel):
    title: Annotated[str, Field(min_length=1, max_length=160)]
    rationale: Text
    audience: Text
    supporting_facts: Annotated[list[Fact], Field(min_length=1, max_length=4)]
    proposed_actions: Annotated[list[Text], Field(min_length=1, max_length=5)]
    assumptions: Annotated[list[Text], Field(max_length=5)]
    success_metrics: Annotated[list[Text], Field(min_length=1, max_length=4)]
    risks: Annotated[list[Text], Field(max_length=4)]


class Answer(StrictModel):
    status: Literal["ready", "needs_information"]
    conflicts: Annotated[list[Text], Field(max_length=4)]
    ideas: Annotated[list[Idea], Field(max_length=3)]
    missing_information: Annotated[list[Text], Field(max_length=6)]


class Observation(StrictModel):
    channel: Annotated[str, Field(min_length=1, max_length=40)]
    metric: Literal["impressions", "clicks", "leads", "members"]
    value: Annotated[int, Field(ge=0)]
    source: Annotated[str, Field(min_length=1, max_length=20)]


class RecommendationAnswer(Answer):
    observations: Annotated[list[Observation], Field(min_length=1, max_length=6)]


def validate_answer(raw, evidence, context=None, recommendation=False):
    answer = (RecommendationAnswer if recommendation else Answer).model_validate_json(raw)
    if recommendation:
        rows = {(row["channel"], row["source"]): row for row in (context or {}).get("results", [])}
        for observation in answer.observations:
            row = rows.get((observation.channel, observation.source))
            if not row or row.get(observation.metric) != observation.value:
                raise ValueError("Performance observations must exactly match a supplied channel, source, metric and value.")
    if answer.status == "ready" and not answer.ideas:
        raise ValueError("A ready response needs at least one idea.")
    if answer.status == "needs_information" and (answer.ideas or not answer.missing_information):
        raise ValueError("An insufficient-evidence response needs questions and no ideas.")
    if answer.conflicts:
        # A model may identify a conflict yet still mark its proposal ready. Fail closed.
        answer.status = "needs_information"
        answer.ideas = []
        if not answer.missing_information:
            answer.missing_information = ["Please resolve this conflict before generating: " + item for item in answer.conflicts]
    sources = {item["citation_id"]: item["text"] for item in evidence}
    normalize = lambda text: " ".join(text.split()).casefold()
    numbers = lambda text: set(re.findall(r"\d+(?:\.\d+)?", text))
    public_numbers = numbers(" ".join(sources.values()))
    if context:
        public_numbers |= numbers(str(context.get("business", {})) + str(context.get("products", [])))
    for idea in answer.ideas:
        for action in idea.proposed_actions:
            for quoted in re.findall(r'"([^"\n]+)"|\'([^\'\n]+)\'|“([^”\n]+)”', action):
                if numbers(" ".join(quoted)) - public_numbers:
                    raise ValueError("Quoted public copy contains unsupported numbers or offer terms; remove them.")
        if context is not None:
            allowed = numbers(str(context.get("goal", {})) + str(context.get("results", [])))
            if any(numbers(metric) - allowed for metric in idea.success_metrics):
                raise ValueError("Do not invent numeric success thresholds; use the supplied goal and result values.")
        for fact in idea.supporting_facts:
            if fact.citation_id not in sources or normalize(fact.quote) not in normalize(sources[fact.citation_id]):
                raise ValueError("Each fact must cite a supplied passage and quote it exactly.")
            if numbers(fact.claim) - numbers(fact.quote):
                raise ValueError("Numbers in factual claims must occur in the quoted evidence.")
    return answer.model_dump()
