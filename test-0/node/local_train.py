import torch
import torch.optim as optim
import torch.nn.functional as F
from model.model import Net
from data.load_data import get_partitioned_data

def train_node(node_id, total_nodes, epochs=1):
    model = Net()
    optimizer = optim.SGD(model.parameters(), lr=0.01)
    dataloader = get_partitioned_data(node_id, total_nodes)

    model.train()
    for _ in range(epochs):
        for data, target in dataloader:
            optimizer.zero_grad()
            output = model(data)
            loss = F.cross_entropy(output, target)
            loss.backward()
            optimizer.step()

    return model.state_dict()
