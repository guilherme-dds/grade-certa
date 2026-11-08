"""
Professores da matriz curricular: guardados pelo id do cadastro, para que renomear um
professor não quebre o vínculo. Nomes sem cadastro (matrizes antigas ou importadas)
continuam como texto em `professores` até existir um professor com aquele nome.
"""
from typing import Dict, List, Tuple

from services.grid_solver import normalizar


def professores_do_item(item: dict) -> Tuple[List[int], List[str]]:
    """Ids e nomes (sem cadastro) de um item salvo, aceitando o formato antigo `professor`."""
    ids = [int(i) for i in item.get("professor_ids") or []]
    nomes = [n.strip() for n in (item.get("professores") or [item.get("professor")]) if n and n.strip()]
    return list(dict.fromkeys(ids)), list(dict.fromkeys(nomes))


def vincular_por_id(matriz: List[dict], id_por_nome: Dict[str, int]) -> List[dict]:
    """Troca os nomes de professores cadastrados pelo id (comparando sem acento e sem caixa)."""
    resultado = []
    for item in matriz or []:
        if not isinstance(item, dict):
            continue
        ids, nomes = professores_do_item(item)
        sem_cadastro = []
        for nome in nomes:
            prof_id = id_por_nome.get(normalizar(nome))
            if prof_id is None:
                sem_cadastro.append(nome)
            elif prof_id not in ids:
                ids.append(prof_id)
        resultado.append({
            **item,
            "professor_ids": ids,
            "professores": sem_cadastro,
            "professor": sem_cadastro[0] if sem_cadastro else None,
        })
    return resultado
