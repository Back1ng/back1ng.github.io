#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import inspect

# Monkey patch for Python 3.14+ compatibility
if not hasattr(inspect, "getargspec"):
    original_getargspec = inspect.getfullargspec

    def patched_getargspec(func):
        spec = original_getargspec(func)
        return spec.args, spec.varargs, spec.varkw, spec.defaults

    inspect.getargspec = patched_getargspec

from pymorphy2 import MorphAnalyzer


def filter_nouns_only():
    morph = MorphAnalyzer()

    # Load dictionary
    with open("dictionary.json", "r", encoding="utf-8") as f:
        words = json.load(f)

    print(f"Starting with {len(words)} words...")

    # Filter only nouns in nominative case
    nouns = []
    processed = 0

    for word in words:
        processed += 1
        if processed % 1000 == 0:
            print(f"Processed {processed}/{len(words)} words...")

        try:
            # Get first parse result
            parse_result = morph.parse(word)[0]

            # Keep only nominative nouns and prefer the base (normal) form
            if (
                parse_result.tag.POS == "NOUN"
                and parse_result.tag.case == "nomn"
                and parse_result.normal_form == word
            ):
                nouns.append(word)
        except Exception as e:
            print(f"Error parsing {word}: {e}")
            continue

    print(f"Found {len(nouns)} nouns out of {len(words)} words")
    print(f"Reduction: {len(words)} → {len(nouns)} ({100 * len(nouns) // len(words)}%)")

    # Save filtered dictionary
    with open("dictionary_nouns.json", "w", encoding="utf-8") as f:
        json.dump(nouns, f, ensure_ascii=False, indent=2)

    # Backup original
    import shutil

    shutil.copy("dictionary.json", "dictionary_all_backup.json")

    # Replace main dictionary
    shutil.copy("dictionary_nouns.json", "dictionary.json")

    print("✅ Done! dictionary.json now contains only nouns.")
    print("📁 Backup saved as dictionary_all_backup.json")


if __name__ == "__main__":
    filter_nouns_only()
