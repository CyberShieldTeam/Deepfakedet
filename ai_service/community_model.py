"""Pinned Community Forensics small ViT, adapted from publisher's MIT architecture."""
MODEL_ID = "OwensLab/commfor-model-384"
REVISION = "6076002bf0d9dd37537f965ee2f06f826c333b61"


def load():
    import torch
    import timm
    from torch import nn
    from safetensors.torch import load_file
    from huggingface_hub import hf_hub_download
    from torchvision import transforms

    network = timm.create_model("vit_small_patch16_384.augreg_in21k_ft_in1k", pretrained=False)
    network.head = nn.Linear(384, 1)
    weights = load_file(hf_hub_download(MODEL_ID, "model.safetensors", revision=REVISION))
    network.load_state_dict({key.removeprefix("vit."): value for key, value in weights.items()}, strict=True)
    network.eval()
    torch.set_num_threads(min(torch.get_num_threads(), 4))
    transform = transforms.Compose([transforms.Resize(440), transforms.CenterCrop(384),
                                    transforms.ToTensor(), transforms.Normalize(
                                        [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
    return network, transform


def score(network, transform, image):
    import torch
    with torch.inference_mode():
        return torch.sigmoid(network(transform(image.convert("RGB")).unsqueeze(0))).item()
