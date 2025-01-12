'use client'
import { useEffect, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useMatomo } from '@jonkoops/matomo-tracker-react'
import api from '../../api/ApiHelper'
import { NotificationListener, SubscriptionType } from '../../api/ApiTypes.d'
import GoogleSignIn from '../GoogleSignIn/GoogleSignIn'
import { toast } from 'react-toastify'
import askForNotificationPermissons from '../../utils/NotificationPermisson'
import NotificationIcon from '@mui/icons-material/NotificationsOutlined'
import styles from './SubscribeButton.module.css'
import SubscribeItemContent from './SubscribeItemContent/SubscribeItemContent'
import { getLoadingElement } from '../../utils/LoadingUtils'
import SubscribePlayerContent from './SubscribePlayerContent/SubscribePlayerContent'
import SubscribeAuctionContent from './SubscribeAuctionContent/SubscribeAuctionContent'
import { useRouter } from 'next/navigation'
import { useWasAlreadyLoggedIn } from '../../utils/Hooks'
import EditIcon from '@mui/icons-material/Edit'
import { Typeahead } from 'react-bootstrap-typeahead'
import NotificationTargetForm from '../NotificationTargets/NotificationTargetForm'

interface Props {
    topic: string
    type: 'player' | 'item' | 'auction'
    buttonContent?: JSX.Element
    isEditButton?: boolean
    onAfterSubscribe?()
    prefill?: {
        listener: NotificationListener
        targetNames: string[]
    }
    popupTitle?: string
    popupButtonText?: string
    successMessage?: string
}

const MAX_FILTERS = 5

function SubscribeButton(props: Props) {
    let { trackEvent } = useMatomo()
    let router = useRouter()
    let [showDialog, setShowDialog] = useState(false)
    let [price, setPrice] = useState(props.prefill?.listener?.price?.toString() || '0')
    let [isPriceAbove, setIsPriceAbove] = useState(props.prefill?.listener?.types?.includes(SubscriptionType.PRICE_HIGHER_THAN) ?? false)
    let [onlyInstantBuy, setOnlyInstantBuy] = useState(props.prefill?.listener?.types?.includes(SubscriptionType.BIN) ?? false)
    let [gotOutbid, setGotOutbid] = useState(props.prefill?.listener?.types?.includes(SubscriptionType.OUTBID) ?? false)
    let [isSold, setIsSold] = useState(props.prefill?.listener?.types?.includes(SubscriptionType.SOLD) ?? false)
    let [isPlayerAuctionCreation, setIsPlayerAuctionCreation] = useState(
        props.prefill?.listener?.types?.includes(SubscriptionType.PLAYER_CREATES_AUCTION) ?? false
    )
    let [isLoggedIn, setIsLoggedIn] = useState(false)
    let [itemFilter, setItemFilter] = useState<ItemFilter | undefined>(props.prefill?.listener?.filter || undefined)
    let [isItemFilterValid, setIsItemFilterValid] = useState(true)
    let wasAlreadyLoggedIn = useWasAlreadyLoggedIn()
    let [notificationTargets, setNotificationTargets] = useState<NotificationTarget[]>([])
    let [selectedNotificationTargets, setSelectedNotificationTargets] = useState<NotificationTarget[]>([])
    let [isLoadingNotificationTargets, setIsLoadingNotificationTargets] = useState(false)
    let [showCreateTargetDialog, setShowCreateTargetDialog] = useState(false)

    async function onSubscribe() {
        trackEvent({ action: 'subscribed', category: 'subscriptions' })
        setShowDialog(false)
        // Set price to 0 per default for item subscriptions
        // This happens if a user only selects a filter and leaves the price field empty
        if (props.type === 'item' && !price) {
            price = '0'
        }

        api.subscribe(props.topic, getSubscriptionTypes(), selectedNotificationTargets, price ? parseInt(price) : undefined, itemFilter)
            .then(() => {
                toast.success(props.successMessage || 'Notifier successfully created!', {
                    onClick: () => {
                        router.push('/subscriptions')
                    }
                })
                if (props.onAfterSubscribe) {
                    props.onAfterSubscribe()
                }
            })
            .catch(error => {
                toast.error(error.message, {
                    onClick: () => {
                        router.push('/subscriptions')
                    }
                })
            })
    }

    function getSubscriptionTypes(): SubscriptionType[] {
        let types: SubscriptionType[] = []
        if (props.type === 'item') {
            if (isPriceAbove) {
                types.push(SubscriptionType.PRICE_HIGHER_THAN)
            }
            if (!isPriceAbove) {
                types.push(SubscriptionType.PRICE_LOWER_THAN)
            }
            if (onlyInstantBuy) {
                types.push(SubscriptionType.BIN)
            }
        }
        if (props.type === 'player') {
            if (gotOutbid) {
                types.push(SubscriptionType.OUTBID)
            }
            if (isSold) {
                types.push(SubscriptionType.SOLD)
            }
            if (isPlayerAuctionCreation) {
                types.push(SubscriptionType.PLAYER_CREATES_AUCTION)
            }
        }
        if (props.type === 'auction') {
            types.push(SubscriptionType.AUCTION)
        }
        return types
    }

    function onLogin() {
        setIsLoggedIn(true)
        setIsLoadingNotificationTargets(true)
        api.getNotificationTargets().then(targets => {
            if (props.prefill?.targetNames) {
                setSelectedNotificationTargets(targets.filter(target => (target.name ? props.prefill?.targetNames.includes(target.name) : false)))
            }
            setNotificationTargets(targets)
            setIsLoadingNotificationTargets(false)
        })
    }

    function isNotifyDisabled() {
        if (itemFilter && Object.keys(itemFilter).length > MAX_FILTERS) {
            return true
        }
        if (props.type === 'item') {
            return itemFilter && Object.keys(itemFilter).length > 0 ? false : price === undefined || price === ''
        }
        if (props.type === 'player') {
            return !gotOutbid && !isSold && !isPlayerAuctionCreation
        }
    }

    function closeDialog() {
        trackEvent({ action: 'subscription dialog closed', category: 'subscriptions' })
        setShowDialog(false)
    }

    function openDialog() {
        trackEvent({ action: 'subscription dialog opened', category: 'subscriptions' })
        setShowDialog(true)
    }

    let dialog2 = (
        <Modal
            show={showCreateTargetDialog}
            onHide={() => {
                setShowCreateTargetDialog(false)
            }}
            className={styles.subscribeDialog}
        >
            <Modal.Header closeButton>
                <Modal.Title>{props.popupTitle || 'Create a Notification Target'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <NotificationTargetForm
                    type="CREATE"
                    onSubmit={target => {
                        setSelectedNotificationTargets([...selectedNotificationTargets, target])
                    }}
                />
            </Modal.Body>
        </Modal>
    )

    let dialog = (
        <Modal show={showDialog} onHide={closeDialog} className={styles.subscribeDialog}>
            <Modal.Header closeButton>
                <Modal.Title>{props.popupTitle || 'Create a Notifier'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {isLoggedIn ? (
                    <div>
                        {props.type === 'item' ? (
                            <SubscribeItemContent
                                itemTag={props.topic}
                                onFilterChange={filter => {
                                    setItemFilter({ ...filter })
                                }}
                                onIsPriceAboveChange={setIsPriceAbove}
                                onOnlyInstantBuyChange={setOnlyInstantBuy}
                                onPriceChange={setPrice}
                                prefill={props.prefill?.listener}
                                onIsFilterValidChange={setIsItemFilterValid}
                            />
                        ) : null}
                        {props.type === 'player' ? (
                            <SubscribePlayerContent
                                onGotOutbidChange={setGotOutbid}
                                onIsSoldChange={setIsSold}
                                onIsPlayerAuctionCreation={setIsPlayerAuctionCreation}
                                prefill={props.prefill?.listener}
                            />
                        ) : null}
                        {props.type === 'auction' ? <SubscribeAuctionContent /> : null}
                        <label htmlFor="notificationTargetsTypeahead">Targets: </label>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <Typeahead
                                id="notificationTargetsTypeahead"
                                className={styles.multiSearch}
                                isLoading={isLoadingNotificationTargets}
                                labelKey="name"
                                style={{ flex: 1 }}
                                options={notificationTargets}
                                placeholder={'Select targets...'}
                                selected={selectedNotificationTargets}
                                onChange={selected => {
                                    setSelectedNotificationTargets(selected as NotificationTarget[])
                                }}
                                multiple={true}
                            />
                            <Button
                                onClick={() => {
                                    setShowCreateTargetDialog(true)
                                }}
                            >
                                Create new target
                            </Button>
                        </div>
                        <Button onClick={onSubscribe} disabled={isNotifyDisabled() || !isItemFilterValid} className={styles.notifyButton}>
                            {props.popupButtonText || 'Notify me'}
                        </Button>
                        {itemFilter && Object.keys(itemFilter).length > MAX_FILTERS ? (
                            <p style={{ color: 'red' }}>You currently can't use more than 5 filters for Notifiers</p>
                        ) : null}
                    </div>
                ) : (
                    <p>To use notifiers, please login with Google: </p>
                )}
                <GoogleSignIn onAfterLogin={onLogin} />
                {wasAlreadyLoggedIn && !isLoggedIn ? getLoadingElement() : ''}
            </Modal.Body>
        </Modal>
    )

    return (
        <div className={styles.subscribeButton}>
            {dialog}
            {dialog2}
            {props.isEditButton ? (
                <div onClick={openDialog}>
                    <EditIcon />
                </div>
            ) : (
                <Button style={{ width: 'max-content' }} onClick={openDialog}>
                    <NotificationIcon />
                    {props.buttonContent || ' Notify'}
                </Button>
            )}
        </div>
    )
}

export default SubscribeButton
