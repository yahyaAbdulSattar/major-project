import copy
import torch

def average_weights(local_weights):
    avg_weights = copy.deepcopy(local_weights[0])
    
    for key in avg_weights.keys():
        for i in range(1, len(local_weights)):
            avg_weights[key] += local_weights[i][key]
        avg_weights[key] = torch.div(avg_weights[key], len(local_weights))
    
    return avg_weights
