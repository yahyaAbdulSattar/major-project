from torchvision import datasets, transforms
from torch.utils.data import DataLoader, Subset
import numpy as np

def get_partitioned_data(idx, total_nodes, batch_size=32):
    transform = transforms.ToTensor()
    dataset = datasets.MNIST(root="./data", train=True, download=True, transform=transform)

    # Evenly split
    part_len = len(dataset) // total_nodes
    start, end = idx * part_len, (idx + 1) * part_len
    subset = Subset(dataset, list(range(start, end)))

    return DataLoader(subset, batch_size=batch_size, shuffle=True)
