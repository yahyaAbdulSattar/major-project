import sys
import os

# Add the project root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import flwr as fl
import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
import torch.nn as nn
import torch.optim as optim
from model.model import Net

DEVICE = "cpu"

transform = transforms.Compose([transforms.ToTensor()])

trainset = datasets.MNIST("./data", train=True, download=True, transform=transform)
trainloader = DataLoader(trainset, batch_size=32, shuffle=True)

testset = datasets.MNIST("./data", train=False, download=True, transform=transform)
testloader = DataLoader(testset, batch_size=32)

model = Net().to(DEVICE)
loss_fn = nn.CrossEntropyLoss()
optimizer = optim.SGD(model.parameters(), lr=0.01)

def train():
    model.train()
    for batch in trainloader:
        x, y = batch
        optimizer.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        optimizer.step()

def test():
    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for x, y in testloader:
            out = model(x)
            pred = out.argmax(1)
            correct += (pred == y).sum().item()
            total += y.size(0)
    return correct / total

class FlowerClient(fl.client.NumPyClient):
    def get_parameters(self):
        return [val.cpu().numpy() for val in model.state_dict().values()]

    def set_parameters(self, parameters):
        params_dict = zip(model.state_dict().keys(), parameters)
        state_dict = {k: torch.tensor(v) for k, v in params_dict}
        model.load_state_dict(state_dict, strict=True)

    def fit(self, parameters, config):
        self.set_parameters(parameters)
        train()
        return self.get_parameters(), len(trainloader.dataset), {}

    def evaluate(self, parameters, config):
        self.set_parameters(parameters)
        acc = test()
        return float(acc), len(testloader.dataset), {"accuracy": acc}

# Start the Flower client with the correct method
fl.client.start_client(
    server_address="127.0.0.1:8080", 
    client=FlowerClient().to_client()  # Use `.to_client()` here
)
