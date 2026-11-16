from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from config.database import get_db
from Modules.Auth.Dependencies import get_token
from Modules.Shows import Service
from Modules.Shows.Schema import ShowCreate, ShowResponse


router = APIRouter(tags=["Shows"])


@router.get("/shows", response_model=List[ShowResponse], status_code=status.HTTP_200_OK)
def list_shows(
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_shows(db, token)


@router.post("/shows", response_model=ShowResponse, status_code=status.HTTP_201_CREATED)
def create_show(
    payload: ShowCreate,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.create_show(db, token, payload)
