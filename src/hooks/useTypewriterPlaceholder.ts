import { useState, useEffect, useRef } from "react";

export interface UseTypewriterPlaceholderOptions {
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  startDelay?: number;
  isPaused?: boolean;
}

/**
 * A custom hook to generate typewriter-style placeholder animations.
 * Iterates through a list of phrases, typing them out and deleting them.
 * 
 * @param phrases List of sentences to type out.
 * @param options Timing and pause options.
 * @returns The current animated string content.
 */
export function useTypewriterPlaceholder(
  phrases: string[],
  options: UseTypewriterPlaceholderOptions = {}
) {
  const {
    typingSpeed = 80,
    deletingSpeed = 40,
    pauseDuration = 1800,
    startDelay = 500,
    isPaused = false,
  } = options;

  const [currentText, setCurrentText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Store state and options in ref to prevent resetting the timer loop when state changes.
  const stateRef = useRef({
    currentText,
    phraseIndex,
    isDeleting,
    phrases,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    startDelay,
    isPaused,
  });

  useEffect(() => {
    stateRef.current = {
      currentText,
      phraseIndex,
      isDeleting,
      phrases,
      typingSpeed,
      deletingSpeed,
      pauseDuration,
      startDelay,
      isPaused,
    };
  }, [currentText, phraseIndex, isDeleting, phrases, typingSpeed, deletingSpeed, pauseDuration, startDelay, isPaused]);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    if (!phrases || phrases.length === 0) {
      setCurrentText("");
      return;
    }

    let timerId: NodeJS.Timeout;

    const tick = () => {
      const state = stateRef.current;
      if (state.isPaused) return;

      const currentPhrase = state.phrases[state.phraseIndex % state.phrases.length];

      if (!state.isDeleting) {
        // Typing: add one character
        const nextText = currentPhrase.slice(0, state.currentText.length + 1);
        setCurrentText(nextText);

        if (nextText === currentPhrase) {
          // Finished typing: pause before starting to delete
          timerId = setTimeout(() => {
            setIsDeleting(true);
          }, state.pauseDuration);
        } else {
          // Keep typing
          timerId = setTimeout(tick, state.typingSpeed);
        }
      } else {
        // Deleting: remove one character
        const nextText = currentPhrase.slice(0, state.currentText.length - 1);
        setCurrentText(nextText);

        if (nextText === "") {
          // Finished deleting: pause, switch to next phrase, then resume typing
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % state.phrases.length);
          timerId = setTimeout(tick, state.startDelay);
        } else {
          // Keep deleting
          timerId = setTimeout(tick, state.deletingSpeed);
        }
      }
    };

    // Kick off the first tick
    timerId = setTimeout(tick, typingSpeed);

    return () => {
      clearTimeout(timerId);
    };
  }, [isPaused, phrases, typingSpeed, deletingSpeed, pauseDuration, startDelay]);

  return currentText;
}
