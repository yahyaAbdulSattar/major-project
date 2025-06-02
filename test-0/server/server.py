import flwr as fl

def fit_config(rnd):
    return {"round": rnd}

strategy = fl.server.strategy.FedAvg(
    fraction_fit=1.0,
    min_fit_clients=2,
    min_available_clients=2,
    on_fit_config_fn=fit_config,
    # Evaluation is handled through `evaluate_fn`, not `fraction_eval`
)

fl.server.start_server(
    server_address="127.0.0.1:8080",
    config=fl.server.ServerConfig(num_rounds=3),
    strategy=strategy,
)