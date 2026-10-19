export const demoScenarios = [
  {
    id: "database-configuration-conflict",
    title: "Demo A · Stored configuration conflict",
    description: "Notes say seed 42 and dataset v2; persisted run evidence says seed 7 and dataset v1, with no learning rate in its configuration.",
    databaseBacked: true,
    transcript: "Researcher: The final image classifier used random seed 42, dataset v2, and learning rate 0.001. We measured 91% accuracy.",
  },
  {
    id: "database-missing-result-evidence",
    title: "Demo B · Missing result evidence",
    description: "Notes claim 91% accuracy, but no evaluation script, result output, or model checkpoint is linked.",
    databaseBacked: true,
    transcript: "Researcher: This classifier used random seed 42, dataset v2, and learning rate 0.001. It reached 91% accuracy.",
  },
  {
    id: "resnet-incomplete",
    title: "ResNet-50 reproducibility review",
    description: "An image-classification experiment with a strong result but missing controls.",
    transcript: "Researcher: We fine-tuned ResNet-50 on CIFAR-10 for 20 epochs using Adam at a learning rate of 0.001. The test accuracy was 91.4 percent.\nColleague: We should document the exact seed and code version before publishing.",
  },
  {
    id: "conflicting-learning-rate",
    title: "Conflicting learning-rate discussion",
    description: "A meeting where two learning rates are mentioned and require clarification.",
    transcript: "Maya: Start with ResNet-50 on CIFAR-10 using Adam.\nNoah: I used learning rate 0.01 in the exploratory run.\nMaya: That was unstable, so the final run used 0.001 for 20 epochs. Accuracy reached 91.4 percent.",
  },
  {
    id: "reproducible-transformer",
    title: "Well-documented transformer experiment",
    description: "A more complete experiment with versioned data, framework, seed, code, and evaluation.",
    transcript: "Researcher: We fine-tuned bert-base-uncased version 1 on dataset IMDB version 1.0 using PyTorch 2.7, AdamW, learning rate 0.00002, batch size 16, 3 epochs, and random seed 42. The code commit is a81c93f. We evaluated once on the fixed IMDB test split and measured 93.2 percent accuracy.",
  },
] as const;
